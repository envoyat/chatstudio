import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { MESSAGE_ROLES } from "./constants";

// Convex validator for message parts
const messagePartValidator = v.union(
  v.object({
    type: v.literal('text'),
    text: v.string(),
  }),
  v.object({
    type: v.literal('tool-call'),
    id: v.string(),
    name: v.string(),
    args: v.any(),
  }),
  v.object({
    type: v.literal('tool-result'),
    toolCallId: v.string(),
    result: v.any(),
  }),
  v.object({
    type: v.literal('image'),
    image: v.string(), // Base64 data URL
    mimeType: v.optional(v.string()),
  }),
  v.object({
    type: v.literal('reasoning'),
    text: v.string(),
  })
);

const toolCallValidator = v.object({
  id: v.string(),
  name: v.string(),
  args: v.any(),
});

const toolOutputValidator = v.object({
  toolCallId: v.string(),
  result: v.any(),
});

export default defineSchema({
  conversations: defineTable({
    uuid: v.string(), // UUID for URL routing
    title: v.string(),
    userId: v.optional(v.string()), // Clerk user ID
    sessionId: v.optional(v.string()), // Guest session ID
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.number(),
    isBranched: v.optional(v.boolean()),
    branchedFrom: v.optional(v.id("conversations")),
    branchedFromTitle: v.optional(v.string()),
    isPublic: v.optional(v.boolean()), // Whether this conversation is publicly shareable
  })
    .index("by_user", ["userId"])
    .index("by_user_and_last_message", ["userId", "lastMessageAt"])
    .index("by_uuid", ["uuid"])
    .index("by_sessionId", ["sessionId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    content: v.string(),
    role: v.union(v.literal(MESSAGE_ROLES.USER), v.literal(MESSAGE_ROLES.ASSISTANT), v.literal(MESSAGE_ROLES.SYSTEM), v.literal(MESSAGE_ROLES.DATA)),
    parts: v.optional(v.array(messagePartValidator)),
    createdAt: v.number(),
    reasoning: v.optional(v.string()), // ADDED: To store streaming reasoning text
    isComplete: v.optional(v.boolean()), // ADDED: To track streaming status
    toolCalls: v.optional(v.array(toolCallValidator)),
    toolOutputs: v.optional(v.array(toolOutputValidator)),
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

  attachments: defineTable({
    userId: v.string(), // The identifier of the user who uploaded the file. Login required.
    storageId: v.id("_storage"), // The ID of the file in Convex File Storage
    fileName: v.string(),
    contentType: v.string(),
    createdAt: v.number(),
    conversationId: v.optional(v.id("conversations")), // Link to the conversation
    promptTokens: v.optional(v.number()), // Tokens for the message turn this was included in
  })
    .index("by_userId", ["userId"])
    .index("by_conversation", ["conversationId"]),
}); 