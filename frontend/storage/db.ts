import type { UIMessage } from "ai"

export interface Thread {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  lastMessageAt: Date
}

export interface DBMessage {
  id: string
  threadId: string
  parts: UIMessage["parts"]
  content: string
  role: "user" | "assistant" | "system" | "data"
  createdAt: Date
}

export interface MessageSummary {
  id: string
  threadId: string
  messageId: string
  content: string
  createdAt: Date
}

class LocalStorageDB {
  private getKey(table: string) {
    return `Chat Studio_${table}`
  }

  private getData<T>(table: string): T[] {
    try {
      const data = localStorage.getItem(this.getKey(table))
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  private setData<T>(table: string, data: T[]): void {
    try {
      localStorage.setItem(this.getKey(table), JSON.stringify(data))
    } catch (error) {
      console.error(`Failed to save ${table}:`, error)
    }
  }

  // Threads
  getThreads(): Thread[] {
    const threads = this.getData<Thread>("threads")
    return threads
      .map((thread) => ({
        ...thread,
        createdAt: new Date(thread.createdAt),
        updatedAt: new Date(thread.updatedAt),
        lastMessageAt: new Date(thread.lastMessageAt),
      }))
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
  }

  addThread(thread: Thread): void {
    const threads = this.getData<Thread>("threads")
    threads.push(thread)
    this.setData("threads", threads)
  }

  updateThread(id: string, updates: Partial<Thread>): void {
    const threads = this.getData<Thread>("threads")
    const index = threads.findIndex((t) => t.id === id)
    if (index !== -1) {
      threads[index] = { ...threads[index], ...updates }
      this.setData("threads", threads)
    }
  }

  deleteThread(id: string): void {
    const threads = this.getData<Thread>("threads").filter((t) => t.id !== id)
    this.setData("threads", threads)

    // Also delete related messages and summaries
    const messages = this.getData<DBMessage>("messages").filter((m) => m.threadId !== id)
    this.setData("messages", messages)

    const summaries = this.getData<MessageSummary>("messageSummaries").filter((s) => s.threadId !== id)
    this.setData("messageSummaries", summaries)
  }

  // Messages
  getMessagesByThreadId(threadId: string): DBMessage[] {
    const messages = this.getData<DBMessage>("messages")
    return messages
      .filter((m) => m.threadId === threadId)
      .map((message) => ({
        ...message,
        createdAt: new Date(message.createdAt),
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  addMessage(message: DBMessage): void {
    const messages = this.getData<DBMessage>("messages")
    messages.push(message)
    this.setData("messages", messages)
  }

  deleteTrailingMessages(threadId: string, createdAt: Date, gte = true): void {
    const messages = this.getData<DBMessage>("messages")
    const filteredMessages = messages.filter((msg) => {
      if (msg.threadId !== threadId) return true

      const msgTime = new Date(msg.createdAt).getTime()
      const targetTime = createdAt.getTime()

      return gte ? msgTime < targetTime : msgTime <= targetTime
    })

    this.setData("messages", filteredMessages)

    // Also delete related summaries
    const deletedMessageIds = messages
      .filter((msg) => {
        if (msg.threadId !== threadId) return false
        const msgTime = new Date(msg.createdAt).getTime()
        const targetTime = createdAt.getTime()
        return gte ? msgTime >= targetTime : msgTime > targetTime
      })
      .map((msg) => msg.id)

    if (deletedMessageIds.length > 0) {
      const summaries = this.getData<MessageSummary>("messageSummaries")
      const filteredSummaries = summaries.filter((s) => !deletedMessageIds.includes(s.messageId))
      this.setData("messageSummaries", filteredSummaries)
    }
  }

  // Message Summaries
  getMessageSummaries(threadId: string): MessageSummary[] {
    const summaries = this.getData<MessageSummary>("messageSummaries")
    return summaries
      .filter((s) => s.threadId === threadId)
      .map((summary) => ({
        ...summary,
        createdAt: new Date(summary.createdAt),
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  addMessageSummary(summary: MessageSummary): void {
    const summaries = this.getData<MessageSummary>("messageSummaries")
    summaries.push(summary)
    this.setData("messageSummaries", summaries)
  }

  // Clear all data
  clearAll(): void {
    localStorage.removeItem(this.getKey("threads"))
    localStorage.removeItem(this.getKey("messages"))
    localStorage.removeItem(this.getKey("messageSummaries"))
  }
}

export const db = new LocalStorageDB()
