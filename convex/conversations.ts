import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { MESSAGE_ROLES } from "./constants";

export const create = mutation({
  args: {
    title: v.string(),
    uuid: v.optional(v.string()),
  },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to create a conversation");
    }

    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      uuid: args.uuid || crypto.randomUUID(),
      title: args.title,
      userId: identity.subject,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
    });

    return conversationId;
  },
});

export const getByUuid = query({
  args: {
    uuid: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      uuid: v.string(),
      title: v.string(),
      userId: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastMessageAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .first();
    
    if (!conversation || conversation.userId !== identity.subject) {
      return null;
    }

    return conversation;
  },
});

export const list = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("conversations"),
    _creationTime: v.number(),
    uuid: v.string(),
    title: v.string(),
    userId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.number(),
  })),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    return await ctx.db
      .query("conversations")
      .withIndex("by_user_and_last_message", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});

export const listWithLastMessage = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      uuid: v.string(),
      title: v.string(),
      userId: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastMessageAt: v.number(),
      lastMessage: v.union(
        v.object({
          role: v.union(v.literal(MESSAGE_ROLES.USER), v.literal(MESSAGE_ROLES.ASSISTANT), v.literal(MESSAGE_ROLES.SYSTEM), v.literal(MESSAGE_ROLES.DATA)),
          isComplete: v.optional(v.boolean()),
        }),
        v.null()
      ),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_and_last_message", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

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
    lastMessageAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to update a conversation");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.userId !== identity.subject) {
      throw new Error("Not authorised to update this conversation");
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) {
      updates.title = args.title;
    }

    if (args.lastMessageAt !== undefined) {
      updates.lastMessageAt = args.lastMessageAt;
    }

    await ctx.db.patch(args.conversationId, updates);
    return null;
  },
});

export const remove = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to delete a conversation");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.userId !== identity.subject) {
      throw new Error("Not authorised to delete this conversation");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    const summaries = await ctx.db
      .query("messageSummaries")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const summary of summaries) {
      await ctx.db.delete(summary._id);
    }

    await ctx.db.delete(args.conversationId);
    return null;
  },
});

export const updateTitle = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(args.conversationId, {
      title: args.title,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const get = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.union(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      uuid: v.string(),
      title: v.string(),
      userId: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastMessageAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      return null;
    }

    return conversation;
  },
}); 