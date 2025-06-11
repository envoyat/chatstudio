import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserQuery, getCurrentUserMutation } from "./lib/auth";

// Get message summaries for a thread
export const getMessageSummaries = query({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.array(v.object({
    _id: v.id("messageSummaries"),
    threadId: v.id("threads"),
    messageId: v.id("messages"),
    userId: v.optional(v.id("users")),
    content: v.string(),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const user = await getCurrentUserQuery(ctx);
    
    // Get the thread to check ownership
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }
    
    // Allow access if user owns the thread or it's anonymous
    if (thread.userId !== user?._id && thread.userId !== undefined) {
      throw new Error("Unauthorized");
    }
    
    return await ctx.db
      .query("messageSummaries")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});

// Create a new message summary
export const createMessageSummary = mutation({
  args: {
    threadId: v.id("threads"),
    messageId: v.id("messages"),
    content: v.string(),
  },
  returns: v.id("messageSummaries"),
  handler: async (ctx, args) => {
    const user = await getCurrentUserMutation(ctx);
    
    // Get the thread to check ownership
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }
    
    // Allow creation if user owns the thread or it's anonymous
    if (thread.userId !== user?._id && thread.userId !== undefined) {
      throw new Error("Unauthorized");
    }
    
    // Verify the message exists and belongs to the thread
    const message = await ctx.db.get(args.messageId);
    if (!message || message.threadId !== args.threadId) {
      throw new Error("Message not found or doesn't belong to thread");
    }
    
    return await ctx.db.insert("messageSummaries", {
      threadId: args.threadId,
      messageId: args.messageId,
      userId: user?._id || undefined,
      content: args.content,
      createdAt: Date.now(),
    });
  },
}); 