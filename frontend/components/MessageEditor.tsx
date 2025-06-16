"use client"

import { useState } from "react"
import type { UIMessage } from "ai"
import type { Dispatch, SetStateAction } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useModelStore } from "../stores/ModelStore"
import { useAPIKeyStore } from "../stores/APIKeyStore"
import { useMemo } from "react"

export default function MessageEditor({
  message,
  setMode,
  convexConversationId,
}: {
  message: UIMessage
  setMode: Dispatch<SetStateAction<"view" | "edit">>
  convexConversationId: Id<"conversations"> | null
}) {
  const [draftContent, setDraftContent] = useState(message.content)
  const deleteTrailingMessages = useMutation(api.messages.deleteTrailing)
  const sendMessage = useMutation(api.messages.send)
  
  const { selectedModel } = useModelStore();
  const { hasUserKey, getKey } = useAPIKeyStore();

  const modelConfig = useMemo(() => {
    return { provider: useModelStore.getState().getModelConfig().provider };
  }, [selectedModel]);

  const handleSaveAndResubmit = async () => {
    if (!convexConversationId || !message.createdAt) {
      toast.error("Cannot edit this message.");
      return;
    }

    try {
      // Delete this message and all subsequent messages.
      await deleteTrailingMessages({
        conversationId: convexConversationId,
        fromCreatedAt: message.createdAt.getTime(),
        inclusive: true, // Include the message being edited
      })

      // Send the new, edited message, which will trigger a new AI response.
      const userApiKeyForModel = hasUserKey(modelConfig.provider) ? getKey(modelConfig.provider) || undefined : undefined;
      await sendMessage({
        conversationId: convexConversationId,
        content: draftContent,
        model: selectedModel,
        userApiKey: userApiKeyForModel,
      })

      setMode("view");
      toast.success("Message updated and resubmitted.");

    } catch (error) {
      console.error("Failed to edit message:", error);
      toast.error("Failed to edit message.");
    }
  }

  return (
    <div className="w-full">
      <Textarea
        value={draftContent}
        onChange={(e) => setDraftContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSaveAndResubmit()
          }
        }}
        className="text-sm"
      />
      <div className="flex justify-end gap-2 mt-2">
        <Button size="sm" onClick={handleSaveAndResubmit}>Save & Resubmit</Button>
        <Button size="sm" variant="ghost" onClick={() => setMode("view")}>Cancel</Button>
      </div>
    </div>
  )
}
