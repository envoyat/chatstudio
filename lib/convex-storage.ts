import type { UIMessage } from "ai";
import type { Id } from "@/convex/_generated/dataModel";

export interface Thread {
  _id: Id<"threads">;
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}

export interface DBMessage {
  _id: Id<"messages">;
  id: string;
  threadId: string;
  parts: UIMessage["parts"];
  content: string;
  role: "user" | "assistant" | "system" | "data";
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
  title: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
}): Thread {
  return {
    _id: convexThread._id,
    id: convexThread._id,
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
  role: "user" | "assistant" | "system" | "data";
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

// For non-authenticated users, provide a simple in-memory storage
class MemoryStorage {
  private threads: Thread[] = [];
  private messages: DBMessage[] = [];
  private summaries: MessageSummary[] = [];

  getThreads(): Thread[] {
    return this.threads.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  addThread(thread: Thread): void {
    this.threads.push(thread);
  }

  updateThread(id: string, updates: Partial<Thread>): void {
    const index = this.threads.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.threads[index] = { ...this.threads[index], ...updates };
    }
  }

  deleteThread(id: string): void {
    this.threads = this.threads.filter((t) => t.id !== id);
    this.messages = this.messages.filter((m) => m.threadId !== id);
    this.summaries = this.summaries.filter((s) => s.threadId !== id);
  }

  getMessagesByThreadId(threadId: string): DBMessage[] {
    return this.messages
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  addMessage(message: DBMessage): void {
    this.messages.push(message);
  }

  deleteTrailingMessages(threadId: string, createdAt: Date, gte = true): void {
    const targetTime = createdAt.getTime();
    
    const deletedMessageIds = this.messages
      .filter((msg) => {
        if (msg.threadId !== threadId) return false;
        const msgTime = msg.createdAt.getTime();
        return gte ? msgTime >= targetTime : msgTime > targetTime;
      })
      .map((msg) => msg.id);

    this.messages = this.messages.filter((msg) => {
      if (msg.threadId !== threadId) return true;
      const msgTime = msg.createdAt.getTime();
      return gte ? msgTime < targetTime : msgTime <= targetTime;
    });

    // Also delete related summaries
    if (deletedMessageIds.length > 0) {
      this.summaries = this.summaries.filter((s) => !deletedMessageIds.includes(s.messageId));
    }
  }

  getMessageSummaries(threadId: string): MessageSummary[] {
    return this.summaries
      .filter((s) => s.threadId === threadId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  addMessageSummary(summary: MessageSummary): void {
    this.summaries.push(summary);
  }

  clearAll(): void {
    this.threads = [];
    this.messages = [];
    this.summaries = [];
  }
}

export const memoryStorage = new MemoryStorage(); 