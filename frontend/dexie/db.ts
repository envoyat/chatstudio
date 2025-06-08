import type { UIMessage } from "ai"
import Dexie, { type Table } from "dexie"

interface Thread {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  lastMessageAt: Date
}

interface DBMessage {
  id: string
  threadId: string
  parts: UIMessage["parts"]
  content: string
  role: "user" | "assistant" | "system" | "data"
  createdAt: Date
}

interface MessageSummary {
  id: string
  threadId: string
  messageId: string
  content: string
  createdAt: Date
}

class ChatDatabase extends Dexie {
  threads!: Table<Thread>
  messages!: Table<DBMessage>
  messageSummaries!: Table<MessageSummary>

  constructor() {
    super("chat0")
    this.version(1).stores({
      threads: "id, title, updatedAt, lastMessageAt",
      messages: "id, threadId, createdAt, [threadId+createdAt]",
      messageSummaries: "id, threadId, messageId, createdAt, [threadId+createdAt]",
    })
  }
}

const db = new ChatDatabase()

export type { Thread, DBMessage, MessageSummary }
export { db }
