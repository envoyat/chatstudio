import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { MESSAGE_ROLES } from "./constants";
import { v4 as uuidv4 } from "uuid";

export const create = mutation({
  args: {
    uuid: v.string(),
    // Add sessionId for guest users
    sessionId: v.optional(v.string()),
  },
  returns: v.id("conversations"),
  handler: async (ctx, { uuid, sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity && !sessionId) {
      throw new Error("Must provide either a user identity or a session ID");
    }

    const existingQuery = identity
      ? ctx.db.query("conversations").withIndex("by_user_and_uuid", q => q.eq("userId", identity.subject).eq("uuid", uuid))
      : ctx.db.query("conversations").withIndex("by_session_and_uuid", q => q.eq("sessionId", sessionId!).eq("uuid", uuid));
    
    // Check if a conversation with this UUID already exists for this user
    const existingConversation = await existingQuery.first();

    if (existingConversation) {
      if (identity && existingConversation.userId !== identity.subject) {
        throw new Error("Not authorised to access this conversation");
      }
      if (!identity && existingConversation.sessionId !== sessionId) {
        throw new Error("Not authorised to access this conversation");
      }
      return existingConversation._id;
    }

    // Create new conversation
    const conversationId = await ctx.db.insert("conversations", {
      uuid,
      title: "New Conversation",
      userId: identity?.subject,
      sessionId: sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessageAt: Date.now(),
    });

    return conversationId;
  },
});

export const getByUuid = query({
  args: {
    uuid: v.string(),
    // Add sessionId for guest users
    sessionId: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      uuid: v.string(),
      title: v.string(),
      userId: v.optional(v.string()), // Clerk user ID
      sessionId: v.optional(v.string()), // Guest session ID
      createdAt: v.number(),
      updatedAt: v.number(),
      lastMessageAt: v.number(),
      isBranched: v.optional(v.boolean()),
      branchedFrom: v.optional(v.id("conversations")),
      branchedFromTitle: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, { uuid, sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity && !sessionId) {
      return null;
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_uuid", (q) => q.eq("uuid", uuid))
      .first();
    
    if (!conversation) {
      return null;
    }

    // Ownership check
    if (identity && conversation.userId !== identity.subject) return null;
    if (!identity && conversation.sessionId !== sessionId) return null;

    return conversation;
  },
});

export const getById = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.union(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      uuid: v.string(),
      title: v.string(),
      userId: v.optional(v.string()),
      sessionId: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastMessageAt: v.number(),
      isBranched: v.optional(v.boolean()),
      branchedFrom: v.optional(v.id("conversations")),
      branchedFromTitle: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, { conversationId }) => {
    const identity = await ctx.auth.getUserIdentity();
    // This query is intended to be used by authenticated users primarily
    // for server-side checks, so we can be stricter here.
    if (!identity) return null;
    
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      return null;
    }

    return conversation;
  },
});

export const list = query({
  args: {
    // Add sessionId for guest users
    sessionId: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      uuid: v.string(),
      title: v.string(),
      userId: v.optional(v.string()),
      sessionId: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastMessageAt: v.number(),
    }),
  ),
  handler: async (ctx, { sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();

    if (identity) {
      return await ctx.db
        .query("conversations")
        .withIndex("by_user_and_last_message", (q) => q.eq("userId", identity.subject))
        .order("desc")
        .collect();
    } else if (sessionId) {
      return await ctx.db
        .query("conversations")
        .withIndex("by_session_and_last_message", (q) => q.eq("sessionId", sessionId))
        .order("desc")
        .collect();
    }

    return [];
  },
});

export const listWithLastMessage = query({
  args: {
    // Add sessionId for guest users
    sessionId: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      uuid: v.string(),
      title: v.string(),
      userId: v.optional(v.string()),
      sessionId: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastMessageAt: v.number(),
      // Add new fields for branching
      isBranched: v.optional(v.boolean()),
      branchedFrom: v.optional(v.id("conversations")),
      branchedFromTitle: v.optional(v.string()),
      // Keep lastMessage as is
      lastMessage: v.union(
        v.object({
          role: v.union(v.literal(MESSAGE_ROLES.USER), v.literal(MESSAGE_ROLES.ASSISTANT), v.literal(MESSAGE_ROLES.SYSTEM), v.literal(MESSAGE_ROLES.DATA)),
          isComplete: v.optional(v.boolean()),
        }),
        v.null()
      ),
    })
  ),
  handler: async (ctx, { sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();

    let conversations;
    if (identity) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_user_and_last_message", (q) => q.eq("userId", identity.subject))
        .order("desc")
        .collect();
    } else if (sessionId) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_session_and_last_message", (q) => q.eq("sessionId", sessionId))
        .order("desc")
        .collect();
    } else {
      return [];
    }

    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conversation) => {
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation_and_created", (q) => q.eq("conversationId", conversation._id))
          .order("desc")
          .first(); 
        
        return {
          ...conversation,
          lastMessage: lastMessage
            ? { role: lastMessage.role, isComplete: lastMessage.isComplete }
            : null,
        };
      })
    );

    return conversationsWithLastMessage;
  },
});

export const update = mutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { conversationId, title }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to update conversations");
    }

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      throw new Error("Not authorised to update this conversation");
    }

    const updates: {
      title?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (title !== undefined) {
      updates.title = title;
    }

    await ctx.db.patch(conversationId, updates);

    return null;
  },
});

export const remove = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
  handler: async (ctx, { conversationId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to delete conversations");
    }

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      throw new Error("Not authorised to delete this conversation");
    }

    // Delete all messages in the conversation
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);

      // Also delete message summaries
      const summaries = await ctx.db
        .query("messageSummaries")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect();

      for (const summary of summaries) {
        await ctx.db.delete(summary._id);
      }
    }

    // Delete the conversation
    await ctx.db.delete(conversationId);

    return null;
  },
});

export const branch = mutation({
  args: {
    originalConversationId: v.id("conversations"),
    branchPointMessageId: v.id("messages"),
  },
  returns: v.object({ newConversationUuid: v.string() }),
  handler: async (ctx, { originalConversationId, branchPointMessageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to branch conversations");
    }

    // 1. Verify ownership and get original conversation details
    const originalConversation = await ctx.db.get(originalConversationId);
    if (!originalConversation || originalConversation.userId !== identity.subject) {
      throw new Error("Not authorised to branch this conversation");
    }

    const branchPointMessage = await ctx.db.get(branchPointMessageId);
    if (!branchPointMessage || branchPointMessage.conversationId !== originalConversationId) {
      throw new Error("Branch point message not found in the original conversation.");
    }

    // 2. Fetch all messages up to the branch point
    const allMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_and_created", (q) => q.eq("conversationId", originalConversationId))
      .order("asc")
      .collect();

    const messagesToCopy = [];
    for (const message of allMessages) {
      messagesToCopy.push(message);
      if (message._id === branchPointMessageId) {
        break;
      }
    }

    // 3. Create the new branched conversation
    const newConversationUuid = uuidv4();
    const newConversationId = await ctx.db.insert("conversations", {
      uuid: newConversationUuid,
      title: `${originalConversation.title} (branched)`,
      userId: identity.subject,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessageAt: Date.now(),
      isBranched: true,
      branchedFrom: originalConversationId,
      branchedFromTitle: originalConversation.title,
    });

    // 4. Copy messages to the new conversation
    for (const message of messagesToCopy) {
      const { _id, _creationTime, conversationId, ...messageData } = message;
      await ctx.db.insert("messages", {
        ...messageData,
        conversationId: newConversationId,
      });
    }

    // 5. Return the new conversation's UUID for navigation
    return { newConversationUuid };
  },
});

export const updateTitle = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { conversationId, title }) => {
    await ctx.db.patch(conversationId, {
      title,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const get = query({
  args: {
    uuid: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      uuid: v.string(),
      title: v.string(),
      userId: v.optional(v.string()),
      sessionId: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastMessageAt: v.number(),
      isBranched: v.optional(v.boolean()),
      branchedFrom: v.optional(v.id("conversations")),
      branchedFromTitle: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, { uuid }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_uuid", (q) => q.eq("uuid", uuid))
      .first();

    if (!conversation || conversation.userId !== identity.subject) {
      return null;
    }

    return conversation;
  },
}); 