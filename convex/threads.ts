import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

// Get all threads for the current user (or all if anonymous)
export const getThreads = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("threads"),
    title: v.string(),
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    
    if (userId) {
      // Return threads for authenticated user
      return await ctx.db
        .query("threads")
        .withIndex("by_user_and_lastMessage", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    } else {
      // For anonymous users, return empty array since they can't persist data
      return [];
    }
  },
});

// Create a new thread
export const createThread = mutation({
  args: {
    id: v.string(), // Client-generated ID
    title: v.optional(v.string()),
  },
  returns: v.id("threads"),
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    
    const now = Date.now();
    
    return await ctx.db.insert("threads", {
      title: args.title || "New Chat",
      userId: userId || undefined,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
    });
  },
});

// Update a thread
export const updateThread = mutation({
  args: {
    threadId: v.id("threads"),
    title: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }
    
    // Check if user owns this thread
    if (thread.userId !== userId) {
      throw new Error("Unauthorized");
    }
    
    const updates: any = {
      updatedAt: Date.now(),
    };
    
    if (args.title !== undefined) {
      updates.title = args.title;
    }
    
    await ctx.db.patch(args.threadId, updates);
    return null;
  },
});

// Delete a thread and all its related data
export const deleteThread = mutation({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }
    
    // Check if user owns this thread
    if (thread.userId !== userId) {
      throw new Error("Unauthorized");
    }
    
    // Delete all messages in this thread
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    
    // Delete all message summaries in this thread
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

// Delete all threads for the current user
export const deleteAllThreads = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    
    if (!userId) {
      throw new Error("Must be authenticated to delete threads");
    }
    
    // Get all threads for this user
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    // Delete each thread (which will also delete messages and summaries)
    for (const thread of threads) {
      // Delete all messages in this thread
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();
      
      for (const message of messages) {
        await ctx.db.delete(message._id);
      }
      
      // Delete all message summaries in this thread
      const summaries = await ctx.db
        .query("messageSummaries")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();
      
      for (const summary of summaries) {
        await ctx.db.delete(summary._id);
      }
      
      // Delete the thread
      await ctx.db.delete(thread._id);
    }
    
    return null;
  },
}); 