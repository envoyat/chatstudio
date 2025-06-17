import type { UIMessage } from "ai";
import type { Id } from "@/convex/_generated/dataModel";
import { type MessageRole } from "@/convex/constants";
import { v } from "convex/values";
import type { MessagePart } from "@/convex/types";

export type Conversation = {
  _id: Id<"conversations">;
  id: string;
  uuid: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  lastMessage?: {
    content: string;
    createdAt: number;
    role?: string;
    isComplete?: boolean;
  } | null;
  isPublic?: boolean;
  isBranched?: boolean;
  branchedFromTitle?: string;
  ownerName?: string;
};

export interface DBMessage {
  _id: Id<"messages">;
  id: string;
  conversationId: string;
  parts: UIMessage["parts"];
  content: string;
  role: MessageRole;
  createdAt: Date;
}

export interface MessageSummary {
  id: string;
  conversationId: string;
  messageId: string;
  content: string;
  createdAt: Date;
}

// This type represents one item from the array returned by `api.conversations.listWithLastMessage`
type ConvexConversationWithDetails = {
  _id: Id<"conversations">;
  _creationTime: number;
  uuid: string;
  title: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
  isBranched?: boolean;
  branchedFrom?: Id<"conversations">;
  branchedFromTitle?: string;
  isPublic?: boolean;
  ownerName?: string;
  lastMessage?: {
    role: MessageRole;
    content: string;
    createdAt: number;
    isComplete?: boolean;
  } | null;
};

// Convert Convex conversation to app conversation format
export function convertConvexConversation(
  convexConversation: ConvexConversationWithDetails
): Conversation {
  return {
    _id: convexConversation._id,
    id: convexConversation.uuid,
    uuid: convexConversation.uuid,
    title: convexConversation.title,
    createdAt: new Date(convexConversation.createdAt),
    updatedAt: new Date(convexConversation.updatedAt),
    lastMessageAt: new Date(convexConversation.lastMessageAt),
    lastMessage: convexConversation.lastMessage,
    isBranched: convexConversation.isBranched,
    branchedFromTitle: convexConversation.branchedFromTitle,
    isPublic: convexConversation.isPublic,
    ownerName: convexConversation.ownerName,
  };
}

// Convert Convex message to app message format
export function convertConvexMessage(convexMessage: {
  _id: Id<"messages">;
  _creationTime: number;
  conversationId: Id<"conversations">;
  content: string;
  role: MessageRole;
  parts?: any;
  createdAt: number;
}): DBMessage {
  return {
    _id: convexMessage._id,
    id: convexMessage._id,
    conversationId: convexMessage.conversationId,
    parts: convexMessage.parts,
    content: convexMessage.content,
    role: convexMessage.role,
    createdAt: new Date(convexMessage.createdAt),
  };
}

/**
 * UIMessage structure for storage in Convex
 * 
 * This represents the structure of a message as it's stored in the Convex database.
 * It closely mirrors the AI SDK's UIMessage interface but with Convex-specific types.
 */
export interface StoredUIMessage {
  /** Unique identifier for the message */
  id: string;
  
  /** Message role - who sent the message */
  role: "user" | "assistant" | "system" | "data";
  
  /** Main text content of the message */
  content: string;
  
  /** Timestamp when the message was created */
  createdAt?: Date;
  
  /** Optional structured data associated with the message */
  data?: Record<string, unknown>;
  
  /** Optional annotations for the message */
  annotations?: unknown[];
  
  /** Optional tool calls and results */
  toolInvocations?: unknown[];
  
  /** Message parts for rich content including tool calls and results */
  parts?: MessagePart[];
}

/**
 * Convex validator for the StoredUIMessage
 * 
 * This validator ensures that stored messages conform to the expected structure
 * when saved to or retrieved from the Convex database.
 */
export const storedUIMessageValidator = v.object({
  id: v.string(),
  role: v.union(
    v.literal("user"),
    v.literal("assistant"), 
    v.literal("system"),
    v.literal("data")
  ),
  content: v.string(),
  createdAt: v.optional(v.any()), // Date objects are serialized as various types
  data: v.optional(v.any()),
  annotations: v.optional(v.array(v.any())),
  toolInvocations: v.optional(v.array(v.any())),
  parts: v.optional(v.array(v.union(
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
    })
  ))),
});

/**
 * Type guard to check if an object is a valid StoredUIMessage
 */
export function isStoredUIMessage(obj: unknown): obj is StoredUIMessage {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'role' in obj &&
    'content' in obj &&
    typeof (obj as any).id === 'string' &&
    ['user', 'assistant', 'system', 'data'].includes((obj as any).role) &&
    typeof (obj as any).content === 'string'
  );
} 