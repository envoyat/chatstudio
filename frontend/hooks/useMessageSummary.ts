import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { toast } from "sonner"
import { useConvexAuth } from "convex/react"
import type { Id } from "@/convex/_generated/dataModel";

export const useMessageSummary = () => {
  const getKey = useAPIKeyStore((state) => state.getKey)
  const hasUserKey = useAPIKeyStore((state) => state.hasUserKey)
  const { isAuthenticated } = useConvexAuth();

  const generateTitleMutation = useMutation(api.messages.generateTitleForMessage)

  const complete = async (
    prompt: string,
    options?: {
      body?: {
        isTitle?: boolean
        messageId: string
        threadId: string
        convexMessageId?: Id<"messages">
        convexThreadId?: Id<"threads">
      }
    }
  ) => {
    const { isTitle = false, messageId, threadId, convexMessageId, convexThreadId } = options?.body || {}

    if (!messageId || !threadId) {
      console.error("MessageId and ThreadId are required for message summary.")
      toast.error("Failed to generate summary: Missing IDs.")
      return
    }

    try {
      if (isAuthenticated && convexMessageId && convexThreadId) {
        const userGoogleApiKey = hasUserKey("google") ? (getKey("google") || undefined) : undefined

        await generateTitleMutation({
          prompt,
          isTitle,
          messageId: convexMessageId,
          threadId: convexThreadId,
          userGoogleApiKey,
        })
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
