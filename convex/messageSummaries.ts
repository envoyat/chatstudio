import { query } from "./_generated/server";
import { v } from "convex/values";

export const getByMessage = query({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.union(
    v.object({
      _id: v.id("messageSummaries"),
      _creationTime: v.number(),
      conversationId: v.id("conversations"),
      messageId: v.id("messages"),
      content: v.string(),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { messageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Get the message to verify ownership
    const message = await ctx.db.get(messageId);
    if (!message) {
      return null;
    }

    // Get the conversation to verify ownership
    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      return null;
    }

    // Get the summary for this message
    const summary = await ctx.db
      .query("messageSummaries")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .first();

    return summary;
  },
});

export const listByConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("messageSummaries"),
      _creationTime: v.number(),
      conversationId: v.id("conversations"),
      messageId: v.id("messages"),
      content: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, { conversationId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get the conversation to verify ownership
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      return [];
    }

    // Get all summaries for this conversation
    const summaries = await ctx.db
      .query("messageSummaries")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .collect();

    return summaries;
  },
}); 