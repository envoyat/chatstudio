"use client"

import Chat from "@/frontend/components/Chat"
import { useParams } from "react-router-dom"
import type { UIMessage } from "ai"
import { useConvexAuth } from "convex/react"
import { useMessages } from "@/lib/convex-hooks"
import { convertConvexMessage } from "@/lib/convex-storage"
import { useMemo } from "react"

export default function Thread() {
  const { id } = useParams()
  if (!id) throw new Error("Thread ID is required")

  const { isAuthenticated } = useConvexAuth()
  
  // For authenticated users, load messages from Convex
  const convexMessages = useMessages(isAuthenticated ? (id as any) : undefined)

  const convertToUIMessages = useMemo(() => {
    if (!isAuthenticated || !convexMessages) return []
    
    return convexMessages.map(convertConvexMessage).map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts as UIMessage["parts"],
      content: message.content || "",
      createdAt: message.createdAt,
    }))
  }, [convexMessages, isAuthenticated])

  // For unauthenticated users, they can't access saved threads
  // This will show a new chat with the threadId
  return <Chat key={id} threadId={id} initialMessages={convertToUIMessages} />
}
