"use client"

import Chat from "@/frontend/components/Chat"
import { useParams } from "react-router-dom"
import { useGetMessagesByThreadId } from "../storage/convex-queries"
import type { UIMessage } from "ai"
import type { Id } from "../../convex/_generated/dataModel"
import type { ConvexMessage } from "../storage/convex-queries"

export default function Thread() {
  const { id } = useParams()
  if (!id) throw new Error("Thread ID is required")

  const messages = useGetMessagesByThreadId(id)

  const convertToUIMessages = (messages?: { id: Id<"messages">; threadId: Id<"threads">; parts: any; content: string; role: "user" | "assistant" | "system" | "data"; createdAt: Date; }[]) => {
    return messages?.map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts as UIMessage["parts"],
      content: message.content || "",
      createdAt: message.createdAt,
    })) as UIMessage[]
  }

  return <Chat key={id} threadId={id} initialMessages={convertToUIMessages(messages) || []} />
}
