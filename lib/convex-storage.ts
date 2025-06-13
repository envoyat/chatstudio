import type { UIMessage } from "ai";
import type { Id } from "@/convex/_generated/dataModel";
import { type MessageRole } from "@/convex/constants";

export interface Thread {
  _id: Id<"threads">;
  id: string;
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
  threadId: string;
  parts: UIMessage["parts"];
  content: string;
  role: MessageRole;
  createdAt: Date;
}

export interface MessageSummary {
  id: string;
  threadId: string;
  messageId: string;
  content: string;
  createdAt: Date;
}

// Convert Convex thread to app thread format
export function convertConvexThread(convexThread: {
  _id: Id<"threads">;
  _creationTime: number;
  uuid: string;
  title: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
}): Thread {
  return {
    _id: convexThread._id,
    id: convexThread.uuid, // Use UUID as the id for URL routing
    title: convexThread.title,
    createdAt: new Date(convexThread.createdAt),
    updatedAt: new Date(convexThread.updatedAt),
    lastMessageAt: new Date(convexThread.lastMessageAt),
  };
}

// Convert Convex message to app message format
export function convertConvexMessage(convexMessage: {
  _id: Id<"messages">;
  _creationTime: number;
  threadId: Id<"threads">;
  content: string;
  role: MessageRole;
  parts?: any;
  createdAt: number;
}): DBMessage {
  return {
    _id: convexMessage._id,
    id: convexMessage._id,
    threadId: convexMessage.threadId,
    parts: convexMessage.parts,
    content: convexMessage.content,
    role: convexMessage.role,
    createdAt: new Date(convexMessage.createdAt),
  };
} 