"use client"

import { type Dispatch, type SetStateAction, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Check, Copy, RefreshCcw, SquarePen } from "lucide-react"
import type { UIMessage } from "ai"
import type { UseChatHelpers } from "@ai-sdk/react"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { useConvexAuth } from "convex/react"
import { useDeleteTrailingMessages } from "@/lib/convex-hooks"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"

interface MessageControlsProps {
  threadId: string
  message: UIMessage
  setMessages: UseChatHelpers["setMessages"]
  content: string
  setMode?: Dispatch<SetStateAction<"view" | "edit">>
  reload: UseChatHelpers["reload"]
  stop: UseChatHelpers["stop"]
  convexThreadId: Id<"threads"> | null
  convexMessageId: Id<"messages">
}

export default function MessageControls({
  threadId,
  message,
  setMessages,
  content,
  setMode,
  reload,
  stop,
  convexThreadId,
  convexMessageId,
}: MessageControlsProps) {
  const [copied, setCopied] = useState(false)
  const hasRequiredKeys = useAPIKeyStore((state) => state.hasRequiredKeys())
  const { isAuthenticated } = useConvexAuth()
  const deleteTrailingMessagesMutation = useDeleteTrailingMessages()

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  const handleRegenerate = async () => {
    if (!hasRequiredKeys) {
      toast.error("API keys are required to regenerate responses.")
      return
    }

    if (!isAuthenticated || !convexThreadId || !convexMessageId) {
      toast.error("Cannot regenerate for unsaved or unauthenticated chats.")
      return
    }

    if (!message.createdAt) {
      toast.error("Cannot regenerate message without creation timestamp.")
      return
    }

    try {
      stop() // Stop any ongoing streaming

      const fromCreatedAt = message.createdAt.getTime()
      
      if (message.role === "user") {
        await deleteTrailingMessagesMutation({
          threadId: convexThreadId,
          fromCreatedAt: fromCreatedAt,
          inclusive: false, // Delete messages *after* this user message
        })

        setMessages((prevMessages) => {
          const userMessageIndex = prevMessages.findIndex((m) => m.id === message.id)
          return userMessageIndex !== -1 ? prevMessages.slice(0, userMessageIndex + 1) : prevMessages
        })

      } else if (message.role === "assistant") {
        await deleteTrailingMessagesMutation({
          threadId: convexThreadId,
          fromCreatedAt: fromCreatedAt,
          inclusive: true, // Delete this assistant message and subsequent ones
        })

        setMessages((prevMessages) => {
          const assistantMessageIndex = prevMessages.findIndex((m) => m.id === message.id)
          return assistantMessageIndex !== -1 ? prevMessages.slice(0, assistantMessageIndex) : prevMessages
        })
      }
      
      reload() // Trigger AI SDK to regenerate
    } catch (error) {
      console.error("Failed to regenerate message:", error)
      toast.error("Failed to regenerate message. Please try again.")
    }
  }

  return (
    <div
      className={cn("opacity-0 group-hover:opacity-100 transition-opacity duration-100 flex gap-1", {
        "absolute mt-5 right-2": message.role === "user",
      })}
    >
      <Button variant="ghost" size="icon" onClick={handleCopy}>
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </Button>
      {setMode && hasRequiredKeys && isAuthenticated && (
        <Button variant="ghost" size="icon" onClick={() => setMode("edit")}>
          <SquarePen className="w-4 h-4" />
        </Button>
      )}
      {hasRequiredKeys && isAuthenticated && (
        <Button variant="ghost" size="icon" onClick={handleRegenerate}>
          <RefreshCcw className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}
