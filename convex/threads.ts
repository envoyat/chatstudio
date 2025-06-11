import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    title: v.string(),
  },
  returns: v.id("threads"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to create a thread");
    }

    const now = Date.now();
    const threadId = await ctx.db.insert("threads", {
      title: args.title,
      userId: identity.subject,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
    });

    return threadId;
  },
});

export const list = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("threads"),
    _creationTime: v.number(),
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
      throw new Error("Not authorized to update this thread");
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
      throw new Error("Not authorized to delete this thread");
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

export const get = query({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.union(
    v.object({
      _id: v.id("threads"),
      _creationTime: v.number(),
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