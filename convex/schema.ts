import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  
  threads: defineTable({
    title: v.string(),
    userId: v.optional(v.id("users")), // Optional for anonymous users
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_lastMessage", ["userId", "lastMessageAt"]),

  messages: defineTable({
    threadId: v.id("threads"),
    userId: v.optional(v.id("users")), // Optional for anonymous users
    parts: v.any(), // UIMessage["parts"] type
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("data")),
    createdAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_and_createdAt", ["threadId", "createdAt"])
    .index("by_user", ["userId"]),

  messageSummaries: defineTable({
    threadId: v.id("threads"),
    messageId: v.id("messages"),
    userId: v.optional(v.id("users")), // Optional for anonymous users
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_message", ["messageId"])
    .index("by_user", ["userId"]),
}); 