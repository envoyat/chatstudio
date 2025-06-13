import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { MESSAGE_ROLES } from "./constants";

export const create = mutation({
  args: {
    title: v.string(),
    uuid: v.optional(v.string()),
  },
  returns: v.id("threads"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to create a thread");
    }

    const now = Date.now();
    const threadId = await ctx.db.insert("threads", {
      uuid: args.uuid || crypto.randomUUID(),
      title: args.title,
      userId: identity.subject,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
    });

    return threadId;
  },
});

export const getByUuid = query({
  args: {
    uuid: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("threads"),
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

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.uuid))
      .first();
    
    if (!thread || thread.userId !== identity.subject) {
      return null;
    }

    return thread;
  },
});

export const list = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("threads"),
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
      .query("threads")
      .withIndex("by_user_and_last_message", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});

// New query to get all threads along with their very last message.
export const listWithLastMessage = query({
  args: {},
  returns: v.array(
    v.object({
      // All fields from the thread document
      _id: v.id("threads"),
      _creationTime: v.number(),
      uuid: v.string(),
      title: v.string(),
      userId: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastMessageAt: v.number(),
      // The last message, which can be null if the thread is empty
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

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_user_and_last_message", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    // For each thread, find its last message.
    const threadsWithLastMessage = await Promise.all(
      threads.map(async (thread) => {
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_thread_and_created", (q) => q.eq("threadId", thread._id))
          .order("desc")
          .first(); // .first() gets the most recent one.
        
        return {
          ...thread,
          lastMessage: lastMessage
            ? { role: lastMessage.role, isComplete: lastMessage.isComplete }
            : null,
        };
      })
    );

    return threadsWithLastMessage;
  },
});

export const update = mutation({
  args: {
    threadId: v.id("threads"),
    title: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to update a thread");
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== identity.subject) {
      throw new Error("Not authorised to update this thread");
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

    await ctx.db.patch(args.threadId, updates);
    return null;
  },
});

export const remove = mutation({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to delete a thread");
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== identity.subject) {
      throw new Error("Not authorised to delete this thread");
    }

    // Delete all messages in the thread
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete all message summaries in the thread
    const summaries = await ctx.db
      .query("messageSummaries")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const summary of summaries) {
      await ctx.db.delete(summary._id);
    }

    // Delete the thread
    await ctx.db.delete(args.threadId);
    return null;
  },
});

// New: Internal mutation to update thread title, callable by actions
export const internalUpdateTitle = internalMutation({
  args: {
    threadId: v.id("threads"),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // No explicit authentication check here, as it's an internal mutation
    // Assumed to be called by an authenticated action.
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    await ctx.db.patch(args.threadId, {
      title: args.title,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const get = query({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.union(
    v.object({
      _id: v.id("threads"),
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

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.subject) {
      return null;
    }

    return thread;
  },
}); 