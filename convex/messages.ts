import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { MESSAGE_ROLES } from "./constants";

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    model: v.string(),
    userApiKey: v.optional(v.string()),
    isWebSearchEnabled: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { conversationId, content, model, userApiKey, isWebSearchEnabled }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authorised to send messages");
    }

    // 1. Insert the user's message into the database.
    // User messages are always considered "complete".
    await ctx.db.insert("messages", {
      conversationId,
      content,
      role: MESSAGE_ROLES.USER,
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
      model,
      userApiKey,
      isWebSearchEnabled,
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
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      conversationId: v.id("conversations"),
      content: v.string(),
      role: v.union(v.literal(MESSAGE_ROLES.USER), v.literal(MESSAGE_ROLES.ASSISTANT), v.literal(MESSAGE_ROLES.SYSTEM), v.literal(MESSAGE_ROLES.DATA)),
      parts: v.optional(v.any()),
      createdAt: v.number(),
      isComplete: v.optional(v.boolean()),
      toolCalls: v.optional(v.any()),
      toolOutputs: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        return [];
    }
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      return [];
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation_and_created", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
  },
});

export const update = internalMutation({
  args: { 
    messageId: v.id("messages"), 
    content: v.string(),
    toolCalls: v.optional(v.any()),
    toolOutputs: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, { messageId, content, toolCalls, toolOutputs }) => {
    const updates: any = { content };
    if (toolCalls !== undefined) updates.toolCalls = toolCalls;
    if (toolOutputs !== undefined) updates.toolOutputs = toolOutputs;
    
    await ctx.db.patch(messageId, updates);
    return null;
  },
});

export const finalise = internalMutation({
  args: { messageId: v.id("messages"), content: v.string() },
  returns: v.null(),
  handler: async (ctx, { messageId, content }) => {
    await ctx.db.patch(messageId, { 
      content, 
      isComplete: true,
      toolCalls: undefined, // Clear tool call data on finalization
      toolOutputs: undefined,
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