import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

export const send = mutation({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
    // We will get model and API key info from the client to pass to the action
    model: v.string(),
    userApiKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, content, model, userApiKey }) => {
    // --- LOGGING START ---
    console.log(`[messages.send] Received request for thread ${threadId}.`);
    // --- LOGGING END ---

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authorized to send messages");
    }

    // 1. Insert the user's message into the database.
    // User messages are always considered "complete".
    await ctx.db.insert("messages", {
      threadId,
      content,
      role: "user",
      createdAt: Date.now(),
      isComplete: true,
    });
    // --- LOGGING START ---
    console.log("[messages.send] Inserted user message.");
    // --- LOGGING END ---

    // 2. Create a placeholder message for the assistant's response.
    // This will appear on the client instantly.
    const assistantMessageId = await ctx.db.insert("messages", {
      threadId,
      content: "", // Start with an empty body
      role: "assistant",
      createdAt: Date.now(),
      isComplete: false, // Mark as incomplete/streaming
    });
    // --- LOGGING START ---
    console.log(`[messages.send] Inserted placeholder assistant message with ID: ${assistantMessageId}.`);
    // --- LOGGING END ---

    // 3. Fetch the latest message history to provide context to the AI.
    const messageHistory = await ctx.db
      .query("messages")
      .withIndex("by_thread_and_created", (q) => q.eq("threadId", threadId))
      .order("asc")
      .collect();

    // 4. Schedule the backend action to stream the AI's response.
    // This runs in the background, decoupled from the client's request.
    // --- LOGGING START ---
    console.log(`[messages.send] Scheduling 'openai.chat' action for assistant message ${assistantMessageId}.`);
    // --- LOGGING END ---
    await ctx.scheduler.runAfter(0, internal.openai.chat, {
      messageHistory,
      assistantMessageId,
      model,
      userApiKey,
    });

    // 5. Update thread's lastMessageAt
    await ctx.db.patch(threadId, {
      lastMessageAt: Date.now(),
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const list = query({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      threadId: v.id("threads"),
      content: v.string(),
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("data")),
      parts: v.optional(v.any()),
      createdAt: v.number(),
      isComplete: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        return [];
    }
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.subject) {
      return [];
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_thread_and_created", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});

// NEW: Internal mutation to append content to the streaming message.
export const update = internalMutation({
  args: { messageId: v.id("messages"), content: v.string() },
  returns: v.null(),
  handler: async (ctx, { messageId, content }) => {
    await ctx.db.patch(messageId, { content });
    return null;
  },
});

// NEW: Internal mutation to finalize the message and mark it as complete.
export const finalize = internalMutation({
  args: { messageId: v.id("messages"), content: v.string() },
  returns: v.null(),
  handler: async (ctx, { messageId, content }) => {
    await ctx.db.patch(messageId, { content, isComplete: true });
    return null;
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