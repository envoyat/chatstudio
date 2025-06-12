"use client"

// Removed local storage imports
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
import { useDeleteTrailingMessages, useCreateMessage } from "@/lib/convex-hooks"

export default function MessageEditor({
  threadId, // This is the UUID from the URL
  message,
  content,
  setMessages,
  reload,
  setMode,
  stop,
  convexThreadId,
  convexMessageId,
}: {
  threadId: string
  message: UIMessage
  content: string
  setMessages: UseChatHelpers["setMessages"]
  setMode: Dispatch<SetStateAction<"view" | "edit">>
  reload: UseChatHelpers["reload"]
  stop: UseChatHelpers["stop"]
  convexThreadId: Id<"threads"> | null
  convexMessageId: Id<"messages">
}) {
  const [draftContent, setDraftContent] = useState(content)
  const getKey = useAPIKeyStore((state) => state.getKey)
  const hasUserKey = useAPIKeyStore((state) => state.hasUserKey)
  const { isAuthenticated } = useConvexAuth(); // Get authentication status
  const { complete } = useMessageSummary(); // Hook for message summary
  const deleteTrailingMessages = useDeleteTrailingMessages();
  const createMessage = useCreateMessage();

  const handleSave = async () => {
    if (!isAuthenticated || !convexThreadId) {
      toast.error("Cannot edit messages in unauthenticated chats.")
      return
    }

    if (!message.createdAt) {
      toast.error("Cannot edit message without creation timestamp.")
      return
    }

    try {
      stop() // Stop any ongoing streaming if user edits

      // Delete all messages from this point forward (inclusive)
      await deleteTrailingMessages({
        threadId: convexThreadId,
        fromCreatedAt: message.createdAt.getTime(),
        inclusive: true,
      })

      // Create the new edited message in Convex
      await createMessage({
        threadId: convexThreadId,
        content: draftContent,
        role: "user",
        parts: [{ type: "text", text: draftContent }],
      })

      // Update UI messages (remove the edited message and all after it)
      setMessages((messages) => {
        const index = messages.findIndex((m) => m.id === message.id)
        return index !== -1 ? messages.slice(0, index) : messages
      })

      setMode("view")
      
      setTimeout(() => {
        reload() // Reload chat to ensure consistency with DB
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
