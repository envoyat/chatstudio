import type { UIMessage } from "ai";
import type { Id } from "@/convex/_generated/dataModel";
import { type MessageRole } from "@/convex/constants";

export interface Conversation {
  _id: Id<"conversations">;
  id: string; // This is the UUID
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  lastMessage?: {
    role: MessageRole;
    isComplete?: boolean;
  } | null;
}

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

// Convert Convex conversation to app conversation format
export function convertConvexConversation(convexConversation: {
  _id: Id<"conversations">;
  _creationTime: number;
  uuid: string;
  title: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
}): Conversation {
  return {
    _id: convexConversation._id,
    id: convexConversation.uuid, // Use UUID as the id for URL routing
    title: convexConversation.title,
    createdAt: new Date(convexConversation.createdAt),
    updatedAt: new Date(convexConversation.updatedAt),
    lastMessageAt: new Date(convexConversation.lastMessageAt),
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