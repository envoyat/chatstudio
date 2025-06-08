import { db, type Thread, type DBMessage, type MessageSummary } from "./db"
import type { UIMessage } from "ai"
import { v4 as uuidv4 } from "uuid"

export const getThreads = async (): Promise<Thread[]> => {
  return db.getThreads()
}

export const createThread = async (id: string): Promise<void> => {
  const thread: Thread = {
    id,
    title: "New Chat",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastMessageAt: new Date(),
  }
  db.addThread(thread)
}

export const updateThread = async (id: string, title: string): Promise<void> => {
  db.updateThread(id, {
    title,
    updatedAt: new Date(),
  })
}

export const deleteThread = async (id: string): Promise<void> => {
  db.deleteThread(id)
}

export const deleteAllThreads = async (): Promise<void> => {
  db.clearAll()
}

export const getMessagesByThreadId = async (threadId: string): Promise<DBMessage[]> => {
  return db.getMessagesByThreadId(threadId)
}

export const createMessage = async (threadId: string, message: UIMessage): Promise<void> => {
  const dbMessage: DBMessage = {
    id: message.id,
    threadId,
    parts: message.parts,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt || new Date(),
  }

  db.addMessage(dbMessage)

  // Update thread's lastMessageAt
  db.updateThread(threadId, {
    lastMessageAt: dbMessage.createdAt,
  })
}

export const deleteTrailingMessages = async (threadId: string, createdAt: Date, gte = true): Promise<void> => {
  db.deleteTrailingMessages(threadId, createdAt, gte)
}

export const createMessageSummary = async (threadId: string, messageId: string, content: string): Promise<void> => {
  const summary: MessageSummary = {
    id: uuidv4(),
    threadId,
    messageId,
    content,
    createdAt: new Date(),
  }
  db.addMessageSummary(summary)
}

export const getMessageSummaries = async (threadId: string): Promise<MessageSummary[]> => {
  return db.getMessageSummaries(threadId)
}
