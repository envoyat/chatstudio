"use client"

import Chat from "@/frontend/components/Chat"
import { useParams } from "react-router-dom"
import { useLiveQuery } from "@/frontend/hooks/useLiveQuery"
import { getMessagesByThreadId } from "../storage/queries"
import type { DBMessage } from "../storage/db"
import type { UIMessage } from "ai"

export default function Thread() {
  const { id } = useParams()
  if (!id) throw new Error("Thread ID is required")

  const messages = useLiveQuery(() => getMessagesByThreadId(id), [id])

  const convertToUIMessages = (messages?: DBMessage[]) => {
    return messages?.map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts as UIMessage["parts"],
      content: message.content || "",
      createdAt: message.createdAt,
    }))
  }

  return <Chat key={id} threadId={id} initialMessages={convertToUIMessages(messages) || []} />
}
