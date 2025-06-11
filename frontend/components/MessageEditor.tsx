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
import { useConvexAuth } from "convex/react" // Import useConvexAuth
import type { Id } from "@/convex/_generated/dataModel"; // Import Convex Id type
import { useMessageSummary } from "@/frontend/hooks/useMessageSummary"

export default function MessageEditor({
  threadId, // This is the UUID from the URL
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
  const { isAuthenticated } = useConvexAuth(); // Get authentication status
  const { complete } = useMessageSummary(); // Hook for message summary

  const generateTitleMutation = useMutation(api.messages.generateTitleForMessage)

  const handleSave = async () => {
    try {
      // For authenticated users, `message.createdAt` will be a timestamp from Convex
      // For unauthenticated users, it's a JS Date object from local storage
      await deleteTrailingMessages(threadId, message.createdAt as Date)

      const updatedMessage: UIMessage = {
        ...message,
        id: uuidv4(), // New UI ID for the edited message
        content: draftContent,
        parts: [
          {
            type: "text" as const,
            text: draftContent,
          },
        ],
        createdAt: new Date(), // New creation date for the edited message
      }

      // Save the updated message to local storage (for both auth states since we're dealing with UI state)
      await createMessage(threadId, updatedMessage)
      triggerUpdate()

      // Update UI messages (this array is managed by AI SDK, so replace edited version)
      setMessages((messages) => {
        const index = messages.findIndex((m) => m.id === message.id)

        if (index !== -1) {
          // Replace the old message with the updated one in the UI
          return [...messages.slice(0, index), updatedMessage, ...messages.slice(index + 1)]
        }
        return messages // Should not happen for an existing message
      })

      // For message editing, we'll use a simplified approach and not call title generation
      // since editing typically doesn't warrant new title generation
      
      setMode("view")
      stop() // Stop any ongoing streaming if user edits

      setTimeout(() => {
        reload() // Reload chat to ensure consistency with DB (especially if messages were deleted)
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
