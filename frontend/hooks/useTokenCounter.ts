import { useEffect } from "react"
import type { UIMessage } from "ai"
import { countTokensInMessages } from "@/lib/token-limits"
import { useChatRunSettingsStore } from "@/frontend/stores/ChatRunSettingsStore"

export const useTokenCounter = (messages: UIMessage[]) => {
  const updateTokenCount = useChatRunSettingsStore((state) => state.updateTokenCount)
  
  useEffect(() => {
    // Calculate token count for all messages
    const totalTokens = countTokensInMessages(messages)
    
    // Update the store with the new token count
    updateTokenCount(totalTokens)
  }, [messages, updateTokenCount])
  
  // Return the current token count from the store
  return useChatRunSettingsStore((state) => state.tokenCount)
} 