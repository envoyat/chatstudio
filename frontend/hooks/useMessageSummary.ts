import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { toast } from "sonner"
import { updateThread } from "@/frontend/storage/queries"
import { triggerUpdate } from "./useLiveQuery"

interface MessageSummaryPayload {
  success: boolean
  title?: string
  error?: string
}

export const useMessageSummary = () => {
  const getKey = useAPIKeyStore((state) => state.getKey)
  const hasUserKey = useAPIKeyStore((state) => state.hasUserKey)

  const generateTitleMutation = useMutation(api.messages.generateTitleForMessage)

  const complete = async (
    prompt: string,
    options?: {
      body?: {
        isTitle?: boolean
        messageId: string
        threadId: string
      }
    }
  ) => {
    const { isTitle = false, messageId, threadId } = options?.body || {}

    if (!messageId || !threadId) {
      console.error("MessageId and ThreadId are required for message summary.")
      toast.error("Failed to generate summary: Missing IDs.")
      return
    }

    try {
      const userGoogleApiKey = hasUserKey("google") ? getKey("google") || undefined : undefined

      await generateTitleMutation({
        prompt,
        isTitle,
        messageId: messageId as any,
        threadId: threadId as any,
        userGoogleApiKey,
      })

      if (!userGoogleApiKey && isTitle) {
        triggerUpdate()
      }
    } catch (error: any) {
      console.error("Error generating title:", error)
      toast.error(error.message || "Failed to generate title")
    }
  }

  return {
    complete,
    isLoading: false,
  }
}
