import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const create = mutation({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("data")),
    parts: v.optional(v.any()),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    // For messages, we don't require authentication since users can chat without logging in
    // But if they are authenticated, we should verify they own the thread
    const identity = await ctx.auth.getUserIdentity();
    
    if (identity) {
      const thread = await ctx.db.get(args.threadId);
      if (!thread) {
        throw new Error("Thread not found");
      }
      if (thread.userId !== identity.subject) {
        throw new Error("Not authorised to add messages to this thread");
      }
    }

    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      content: args.content,
      role: args.role,
      parts: args.parts,
      createdAt: Date.now(),
    });

    // Update thread's lastMessageAt
    if (identity) {
      await ctx.db.patch(args.threadId, {
        lastMessageAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return messageId;
  },
});

export const list = query({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.array(v.object({
    _id: v.id("messages"),
    _creationTime: v.number(),
    threadId: v.id("threads"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("data")),
    parts: v.optional(v.any()),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    // For listing messages, we allow unauthenticated access for temporary threads
    const identity = await ctx.auth.getUserIdentity();
    
    if (identity) {
      const thread = await ctx.db.get(args.threadId);
      if (!thread || thread.userId !== identity.subject) {
        return [];
      }
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_thread_and_created", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});

export const deleteTrailing = mutation({
  args: {
    threadId: v.id("threads"),
    fromCreatedAt: v.number(),
    inclusive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to delete messages");
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.subject) {
      throw new Error("Not authorized to delete messages from this thread");
    }

    const inclusive = args.inclusive ?? true;
    
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_and_created", (q) => q.eq("threadId", args.threadId))
      .collect();

    const messagesToDelete = messages.filter(msg => 
      inclusive ? msg.createdAt >= args.fromCreatedAt : msg.createdAt > args.fromCreatedAt
    );

    for (const message of messagesToDelete) {
      await ctx.db.delete(message._id);
      
      // Also delete related summaries
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

// New: Internal mutation to create a message summary, callable by actions
export const internalCreateSummary = internalMutation({
  args: {
    threadId: v.id("threads"),
    messageId: v.id("messages"),
    content: v.string(),
  },
  returns: v.id("messageSummaries"),
  handler: async (ctx, args) => {
    // No explicit authentication check here, as it's an internal mutation
    // Assumed to be called by an authenticated action.
    const summaryId = await ctx.db.insert("messageSummaries", {
      threadId: args.threadId,
      messageId: args.messageId,
      content: args.content,
      createdAt: Date.now(),
    });
    return summaryId;
  },
});

// New: Client-callable mutation to trigger title generation
export const generateTitleForMessage = mutation({
  args: {
    prompt: v.string(),
    isTitle: v.optional(v.boolean()),
    messageId: v.id("messages"),
    threadId: v.id("threads"),
    userGoogleApiKey: v.optional(v.string()), // Pass user's key to the action
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // The client calls this mutation.
    // We then schedule the internal AI action to do the actual work.
    // This allows the client call to complete quickly, and the AI work
    // happens in the background, safely integrated with Convex's scheduler.
    await ctx.scheduler.runAfter(
      0, // Run immediately
      internal.ai.generateTitle, // Reference the internal action
      {
        prompt: args.prompt,
        isTitle: args.isTitle,
        messageId: args.messageId,
        threadId: args.threadId,
        userGoogleApiKey: args.userGoogleApiKey,
      },
    );
    // No direct return from this mutation is needed, as the action handles DB updates.
    return null;
  },
}); 