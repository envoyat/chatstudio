import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { MESSAGE_ROLES } from "./constants";

export default defineSchema({
  conversations: defineTable({
    uuid: v.string(), // UUID for URL routing
    title: v.string(),
    userId: v.string(), // Clerk user ID
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_last_message", ["userId", "lastMessageAt"])
    .index("by_uuid", ["uuid"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    content: v.string(),
    role: v.union(v.literal(MESSAGE_ROLES.USER), v.literal(MESSAGE_ROLES.ASSISTANT), v.literal(MESSAGE_ROLES.SYSTEM), v.literal(MESSAGE_ROLES.DATA)),
    parts: v.optional(v.any()), // UIMessage parts
    createdAt: v.number(),
    isComplete: v.optional(v.boolean()), // ADDED: To track streaming status
    toolCalls: v.optional(v.any()),
    toolOutputs: v.optional(v.any()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_and_created", ["conversationId", "createdAt"]),

  messageSummaries: defineTable({
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_message", ["messageId"]),
}); 