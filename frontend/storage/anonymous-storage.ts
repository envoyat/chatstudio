// Temporary storage for anonymous users
// This allows users to chat without logging in, but data is lost on page refresh

interface AnonymousThread {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  lastMessageAt: number
}

interface AnonymousMessage {
  id: string
  threadId: string
  parts: any
  content: string
  role: "user" | "assistant" | "system" | "data"
  createdAt: number
}

const STORAGE_PREFIX = "chatstudio_anonymous_"

export class AnonymousStorage {
  private getKey(table: string): string {
    return `${STORAGE_PREFIX}${table}`
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
  getThreads(): AnonymousThread[] {
    return this.getData<AnonymousThread>("threads")
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  }

  addThread(thread: AnonymousThread): void {
    const threads = this.getData<AnonymousThread>("threads")
    threads.push(thread)
    this.setData("threads", threads)
  }

  updateThread(id: string, updates: Partial<AnonymousThread>): void {
    const threads = this.getData<AnonymousThread>("threads")
    const index = threads.findIndex((t) => t.id === id)
    if (index !== -1) {
      threads[index] = { ...threads[index], ...updates }
      this.setData("threads", threads)
    }
  }

  deleteThread(id: string): void {
    const threads = this.getData<AnonymousThread>("threads").filter((t) => t.id !== id)
    this.setData("threads", threads)

    // Also delete related messages
    const messages = this.getData<AnonymousMessage>("messages").filter((m) => m.threadId !== id)
    this.setData("messages", messages)
  }

  // Messages
  getMessagesByThreadId(threadId: string): AnonymousMessage[] {
    return this.getData<AnonymousMessage>("messages")
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  addMessage(message: AnonymousMessage): void {
    const messages = this.getData<AnonymousMessage>("messages")
    messages.push(message)
    this.setData("messages", messages)
  }

  deleteTrailingMessages(threadId: string, createdAt: number, gte = true): void {
    const messages = this.getData<AnonymousMessage>("messages")
    const filteredMessages = messages.filter((msg) => {
      if (msg.threadId !== threadId) return true
      return gte ? msg.createdAt < createdAt : msg.createdAt <= createdAt
    })
    this.setData("messages", filteredMessages)
  }

  // Clear all data
  clearAll(): void {
    localStorage.removeItem(this.getKey("threads"))
    localStorage.removeItem(this.getKey("messages"))
  }

  // Migrate data to server when user logs in
  getDataForMigration() {
    return {
      threads: this.getThreads(),
      messages: this.getData<AnonymousMessage>("messages"),
    }
  }
}

export const anonymousStorage = new AnonymousStorage(); 