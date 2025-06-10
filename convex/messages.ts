import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

// Get all messages for a thread
export const getMessagesByThreadId = query({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.array(v.object({
    _id: v.id("messages"),
    threadId: v.id("threads"),
    userId: v.optional(v.id("users")),
    parts: v.any(),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("data")),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    
    // Get the thread to check ownership
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }
    
    // Allow access if user owns the thread or it's anonymous
    if (thread.userId !== userId && thread.userId !== undefined) {
      throw new Error("Unauthorized");
    }
    
    return await ctx.db
      .query("messages")
      .withIndex("by_thread_and_createdAt", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});

// Create a new message
export const createMessage = mutation({
  args: {
    threadId: v.id("threads"),
    messageId: v.string(), // Client-generated ID
    parts: v.any(), // UIMessage["parts"] type
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("data")),
    createdAt: v.optional(v.number()),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    
    // Get the thread to check ownership and update lastMessageAt
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }
    
    // Allow creation if user owns the thread or it's anonymous
    if (thread.userId !== userId && thread.userId !== undefined) {
      throw new Error("Unauthorized");
    }
    
    const now = args.createdAt || Date.now();
    
    // Create the message
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      userId: userId || undefined,
      parts: args.parts,
      content: args.content,
      role: args.role,
      createdAt: now,
    });
    
    // Update thread's lastMessageAt
    await ctx.db.patch(args.threadId, {
      lastMessageAt: now,
      updatedAt: now,
    });
    
    return messageId;
  },
});

// Delete trailing messages from a certain time
export const deleteTrailingMessages = mutation({
  args: {
    threadId: v.id("threads"),
    createdAt: v.number(),
    gte: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    const gte = args.gte !== false; // default to true
    
    // Get the thread to check ownership
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }
    
    // Allow deletion if user owns the thread or it's anonymous
    if (thread.userId !== userId && thread.userId !== undefined) {
      throw new Error("Unauthorized");
    }
    
    // Get messages to delete
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_and_createdAt", (q) => q.eq("threadId", args.threadId))
      .collect();
    
    const messagesToDelete = messages.filter((msg) => {
      return gte ? msg.createdAt >= args.createdAt : msg.createdAt > args.createdAt;
    });
    
    // Delete the messages
    for (const message of messagesToDelete) {
      await ctx.db.delete(message._id);
    }
    
    // Delete related summaries
    const summaries = await ctx.db
      .query("messageSummaries")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();
    
    const summariesToDelete = summaries.filter((summary) =>
      messagesToDelete.some((msg) => msg._id === summary.messageId)
    );
    
    for (const summary of summariesToDelete) {
      await ctx.db.delete(summary._id);
    }
    
    return null;
  },
}); 