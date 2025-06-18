import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { MESSAGE_ROLES } from "./constants";
import type { MessagePart, ToolCall, ToolOutput } from "./types";
import type { Id } from "./_generated/dataModel";

// Convex validator for message parts
const messagePartValidator = v.union(
  v.object({
    type: v.literal('text'),
    text: v.string(),
  }),
  v.object({
    type: v.literal('tool-call'),
    id: v.string(),
    name: v.string(),
    args: v.any(),
  }),
  v.object({
    type: v.literal('tool-result'),
    toolCallId: v.string(),
    result: v.any(),
  }),
  v.object({
    type: v.literal('image'),
    image: v.string(), // Base64 data URL
    mimeType: v.optional(v.string()),
  }),
  v.object({
    type: v.literal('reasoning'),
    text: v.string(),
  })
);

const toolCallValidator = v.object({
  id: v.string(),
  name: v.string(),
  args: v.any(), // Keep as any for Convex validator compatibility
});

const toolOutputValidator = v.object({
  toolCallId: v.string(),
  result: v.any(), // Keep as any for Convex validator compatibility
});

// Validator for attachment references
const attachmentRefValidator = v.object({
  attachmentId: v.id("attachments"),
  fileName: v.string(),
  contentType: v.string(),
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    model: v.string(),
    provider: v.optional(v.string()), // Accept the provider from the client
    userApiKey: v.optional(v.string()),
    isWebSearchEnabled: v.optional(v.boolean()),
    isThinkingEnabled: v.optional(v.boolean()),
    attachmentRefs: v.optional(v.array(attachmentRefValidator)),
    sessionId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { conversationId, content, model, provider, userApiKey, isWebSearchEnabled, isThinkingEnabled, attachmentRefs, sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    const conversation = await ctx.db.get(conversationId);
    const userId = identity?.subject;

    // Authorization check
    if (userId) {
      if (!conversation || conversation.userId !== userId) {
        throw new Error("Not authorised to send messages to this conversation");
      }
    } else if (sessionId) {
      if (!conversation || conversation.sessionId !== sessionId) {
        throw new Error("Not authorised for this guest session.");
      }
      // Rate limit check for guests (10 user messages)
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .filter((q) => q.eq(q.field("role"), MESSAGE_ROLES.USER))
        .collect();
      if (messages.length >= 10) {
        throw new Error("Guest message limit reached. Please log in to continue.");
      }
    } else {
      throw new Error("Authentication or session ID is required.");
    }

    // Process attachments and create message parts
    const messageParts: MessagePart[] = [];
    const newAttachmentIds: Id<"attachments">[] = []; // Keep track of attachments used in this message
    
    // Add text content as a part
    if (content.trim()) {
      messageParts.push({
        type: 'text',
        text: content,
      });
    }

    // Process attachment references if provided
    if (attachmentRefs && attachmentRefs.length > 0) {
      for (const attachmentRef of attachmentRefs) {
        // Verify the attachment exists and belongs to the user
        const attachment = await ctx.db.get(attachmentRef.attachmentId); // Guests can't upload, so only check userId
        if (!attachment || attachment.userId !== identity?.subject) {
          throw new Error(`Attachment not found or not owned by user: ${attachmentRef.fileName}`);
        }

        // Link attachment to conversation if not already linked
        if (!attachment.conversationId) {
          await ctx.db.patch(attachmentRef.attachmentId, {
            conversationId: conversationId,
          });
        }

        // Track this attachment for token count updates
        newAttachmentIds.push(attachmentRef.attachmentId);

        // Get the storage URL for the attachment
        const attachmentUrl = await ctx.storage.getUrl(attachment.storageId);
        if (!attachmentUrl) {
          throw new Error(`Could not get URL for attachment: ${attachmentRef.fileName}`);
        }

        // Add image part for images
        if (attachment.contentType.startsWith('image/')) {
          // For AI processing, we need the base64 data. Since we can't fetch in a mutation,
          // we'll store the attachment URL and handle this in the AI action
          messageParts.push({
            type: 'image',
            image: attachmentUrl, // We'll convert this to base64 in the AI action
            mimeType: attachment.contentType,
          });
        }
      }
    }

    // 1. Insert the user's message to the database.
    const userMessageId = await ctx.db.insert("messages", {
      conversationId,
      content,
      role: MESSAGE_ROLES.USER,
      parts: messageParts.length > 0 ? messageParts : undefined,
      createdAt: Date.now(),
      isComplete: true,
    });

    // 2. Create a placeholder message for the assistant's response.
    // This will appear on the client instantly.
    const assistantMessageId = await ctx.db.insert("messages", {
      conversationId,
      content: "", // Start with an empty body
      role: MESSAGE_ROLES.ASSISTANT,
      createdAt: Date.now(),
      isComplete: false, // Mark as incomplete/streaming
    });

    // 3. Fetch the latest message history to provide context to the AI.
    const messageHistory = await ctx.db
      .query("messages")
      .withIndex("by_conversation_and_created", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .collect();

    // 4. Schedule the backend action to stream the AI's response.
    // This runs in the background, decoupled from the client's request.
    await ctx.scheduler.runAfter(0, internal.ai.chat, {
      messageHistory,
      assistantMessageId,
      conversationId,
      model,
      provider, // Pass provider to the action
      userApiKey,
      isWebSearchEnabled,
      isThinkingEnabled,
      newAttachmentIds, // Pass attachment IDs for token tracking
    });

    // 5. Update conversation's lastMessageAt
    await ctx.db.patch(conversationId, {
      lastMessageAt: Date.now(),
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const list = query({
  args: { conversationId: v.id("conversations"), sessionId: v.optional(v.string()) },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      conversationId: v.id("conversations"),
      content: v.string(),
      role: v.union(v.literal(MESSAGE_ROLES.USER), v.literal(MESSAGE_ROLES.ASSISTANT), v.literal(MESSAGE_ROLES.SYSTEM), v.literal(MESSAGE_ROLES.DATA)),
      parts: v.optional(v.array(messagePartValidator)),
      createdAt: v.number(),
      reasoning: v.optional(v.string()),
      isComplete: v.optional(v.boolean()),
      toolCalls: v.optional(v.array(toolCallValidator)),
      toolOutputs: v.optional(v.array(toolOutputValidator)),
    }),
  ),
  handler: async (ctx, { conversationId, sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    const conversation = await ctx.db.get(conversationId);

    if (!conversation) return [];

    const isOwner = identity && conversation.userId === identity.subject;
    const isGuestOwner = !identity && sessionId && conversation.sessionId === sessionId;
    const isPublic = conversation.isPublic;

    const hasAccess = isOwner || isGuestOwner || isPublic;

    if (hasAccess) {
      return await ctx.db
        .query("messages")
        .withIndex("by_conversation_and_created", (q) => q.eq("conversationId", conversationId))
        .order("asc")
        .collect();
    }

    return [];
  },
});

export const update = internalMutation({
  args: { 
    messageId: v.id("messages"), 
    parts: v.optional(v.array(messagePartValidator)),
    reasoning: v.optional(v.string()),
    content: v.optional(v.string()),
    toolCalls: v.optional(v.array(toolCallValidator)),
    toolOutputs: v.optional(v.array(toolOutputValidator)),
  },
  returns: v.null(),
  handler: async (ctx, { messageId, parts, reasoning, content, toolCalls, toolOutputs }) => {
    const updates: {
      parts?: MessagePart[];
      reasoning?: string;
      content?: string;
      toolCalls?: ToolCall[];
      toolOutputs?: ToolOutput[];
    } = {};
    
    if (reasoning !== undefined) updates.reasoning = reasoning;
    if (parts !== undefined) updates.parts = parts;
    if (content !== undefined) updates.content = content;
    if (toolCalls !== undefined) updates.toolCalls = toolCalls;
    if (toolOutputs !== undefined) updates.toolOutputs = toolOutputs;
    
    await ctx.db.patch(messageId, updates);
    return null;
  },
});

export const finalise = internalMutation({
  args: { 
    messageId: v.id("messages"), 
    content: v.string(),
    parts: v.array(messagePartValidator),
  },
  returns: v.null(),
  handler: async (ctx, { messageId, content, parts }) => {
    await ctx.db.patch(messageId, {
      content,
      parts,
      isComplete: true,
      // Clear the temporary reasoning field
      reasoning: undefined,
    });
    return null;
  },
});

export const deleteTrailing = mutation({
  args: {
    conversationId: v.id("conversations"),
    fromCreatedAt: v.number(),
    inclusive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to delete messages");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      throw new Error("Not authorised to delete messages from this conversation");
    }

    const inclusive = args.inclusive ?? true;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_and_created", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const messagesToDelete = messages.filter((msg) =>
      inclusive ? msg.createdAt >= args.fromCreatedAt : msg.createdAt > args.fromCreatedAt,
    );

    for (const message of messagesToDelete) {
      await ctx.db.delete(message._id);

      const summaries = await ctx.db
        .query("messageSummaries")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect();

      for (const summary of summaries) {
        await ctx.db.delete(summary._id);
      }
    }

    return null;
  },
});

export const internalCreateSummary = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    content: v.string(),
  },
  returns: v.id("messageSummaries"),
  handler: async (ctx, args) => {
    const summaryId = await ctx.db.insert("messageSummaries", {
      conversationId: args.conversationId,
      messageId: args.messageId,
      content: args.content,
      createdAt: Date.now(),
    });
    return summaryId;
  },
});

export const generateTitleForMessage = mutation({
  args: {
    prompt: v.string(),
    isTitle: v.optional(v.boolean()),
    messageId: v.id("messages"),
    conversationId: v.id("conversations"),
    userGoogleApiKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(
      0,
      internal.ai.generateTitle,
      {
        prompt: args.prompt,
        isTitle: args.isTitle,
        messageId: args.messageId,
        conversationId: args.conversationId,
        userGoogleApiKey: args.userGoogleApiKey,
      },
    );
    return null;
  },
}); 