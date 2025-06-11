"use client"

import { createMessage, deleteTrailingMessages, createMessageSummary } from "@/frontend/storage/queries"
import { triggerUpdate } from "@/frontend/hooks/useLiveQuery"
import { type UseChatHelpers } from "@ai-sdk/react"
import { useState } from "react"
import type { UIMessage } from "ai"
import type { Dispatch, SetStateAction } from "react"
import { v4 as uuidv4 } from "uuid"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { toast } from "sonner"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"

export default function MessageEditor({
  threadId,
  message,
  content,
  setMessages,
  reload,
  setMode,
  stop,
}: {
  threadId: string
  message: UIMessage
  content: string
  setMessages: UseChatHelpers["setMessages"]
  setMode: Dispatch<SetStateAction<"view" | "edit">>
  reload: UseChatHelpers["reload"]
  stop: UseChatHelpers["stop"]
}) {
  const [draftContent, setDraftContent] = useState(content)
  const getKey = useAPIKeyStore((state) => state.getKey)
  const hasUserKey = useAPIKeyStore((state) => state.hasUserKey)

  const generateTitleMutation = useMutation(api.messages.generateTitleForMessage)

  const handleSave = async () => {
    try {
      await deleteTrailingMessages(threadId, message.createdAt as Date)

      const updatedMessage = {
        ...message,
        id: uuidv4(),
        content: draftContent,
        parts: [
          {
            type: "text" as const,
            text: draftContent,
          },
        ],
        createdAt: new Date(),
      }

      await createMessage(threadId, updatedMessage)
      triggerUpdate()

      setMessages((messages) => {
        const index = messages.findIndex((m) => m.id === message.id)

        if (index !== -1) {
          return [...messages.slice(0, index), updatedMessage]
        }

        return messages
      })

      const userGoogleApiKey = hasUserKey("google") ? getKey("google") || undefined : undefined
      await generateTitleMutation({
        prompt: draftContent,
        messageId: updatedMessage.id as any,
        threadId: threadId as any,
        userGoogleApiKey,
      })

      setMode("view")

      stop()

      setTimeout(() => {
        reload()
      }, 0)
    } catch (error) {
      console.error("Failed to save message:", error)
      toast.error("Failed to save message")
    }
  }

  return (
    <div>
      <Textarea
        value={draftContent}
        onChange={(e) => setDraftContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSave()
          }
        }}
      />
      <div className="flex gap-2 mt-2">
        <Button onClick={handleSave}>Save</Button>
        <Button onClick={() => setMode("view")}>Cancel</Button>
      </div>
    </div>
  )
}
