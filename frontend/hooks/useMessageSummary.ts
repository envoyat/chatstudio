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
        conversationId: string
        convexMessageId?: Id<"messages">
        convexConversationId?: Id<"conversations">
      }
    }
  ) => {
    const { isTitle = false, messageId, conversationId, convexMessageId, convexConversationId } = options?.body || {}

    if (!messageId || !conversationId) {
      console.error("MessageId and ConversationId are required for message summary.")
      toast.error("Failed to generate summary: Missing IDs.")
      return
    }

    try {
      if (isAuthenticated && convexMessageId && convexConversationId) {
        const userGoogleApiKey = hasUserKey("google") ? (getKey("google") || undefined) : undefined

        await generateTitleMutation({
          prompt,
          isTitle,
          messageId: convexMessageId,
          conversationId: convexConversationId,
          userGoogleApiKey,
        })
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate title";
      console.error("Error generating title:", errorMessage);
      toast.error(errorMessage);
    }
  }

  return {
    complete,
    isLoading: false,
  }
}
