"use client"

import { useChat } from "@ai-sdk/react"
import Messages from "./Messages"
import ChatInput from "./ChatInput"
import type { UIMessage } from "ai"
import { v4 as uuidv4 } from "uuid"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { useModelStore } from "@/frontend/stores/ModelStore"
import { getEffectiveModelConfig } from "@/lib/models"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useCreateMessage, useCreateThread, useUpdateThread, useThreadByUuid } from "@/lib/convex-hooks"
import { memoryStorage } from "@/lib/convex-storage"
import { useState, useCallback, useEffect } from "react"
import { useConvexAuth } from "convex/react"
import { getConvexHttpUrl } from "@/lib/utils"

interface ChatProps {
  threadId: string
  initialMessages: UIMessage[]
}

export default function Chat({ threadId, initialMessages }: ChatProps) {
  const { getKey, hasUserKey } = useAPIKeyStore()
  const selectedModel = useModelStore((state) => state.selectedModel)
  const [convexThreadId, setConvexThreadId] = useState<string | null>(null)
  const { isAuthenticated } = useConvexAuth()
  
  // Convex queries and mutations
  const existingThread = useThreadByUuid(isAuthenticated ? threadId : undefined)
  const createMessage = useCreateMessage()
  const createThread = useCreateThread()
  const updateThread = useUpdateThread()
  
  // Set convexThreadId if thread exists
  useEffect(() => {
    if (existingThread) {
      setConvexThreadId(existingThread._id)
    }
  }, [existingThread])
  
  // Determine if a user key is available for the selected model's provider
  // This will be passed to the Convex HTTP action.
  const modelConfig = getEffectiveModelConfig(selectedModel, getKey, hasUserKey);
  const userApiKeyForModel = hasUserKey(modelConfig.provider) ? getKey(modelConfig.provider) : undefined;

  const saveMessage = useCallback(async (message: UIMessage) => {
    if (isAuthenticated) {
      let threadIdToUse = convexThreadId

      // Create thread if it doesn't exist and this is the first user message
      if (!threadIdToUse && message.role === "user") {
        try {
          threadIdToUse = await createThread({ 
            title: message.content.slice(0, 50) + "...",
            uuid: threadId // Use the threadId from the URL as the UUID
          })
          setConvexThreadId(threadIdToUse)
        } catch (error) {
          console.error("Failed to create thread:", error)
          return
        }
      }

      if (threadIdToUse) {
        try {
          await createMessage({
            threadId: threadIdToUse as any,
            content: message.content,
            role: message.role,
            parts: message.parts,
          })

          // Update thread's lastMessageAt
          await updateThread({
            threadId: threadIdToUse as any,
            lastMessageAt: Date.now(),
          })
        } catch (error) {
          console.error("Failed to save message:", error)
        }
      }
    } else {
      // For unauthenticated users, save to memory storage
      memoryStorage.addMessage({
        _id: message.id as any, // Not a real Convex ID, but for compatibility
        id: message.id,
        threadId,
        content: message.content,
        role: message.role,
        parts: message.parts,
        createdAt: message.createdAt || new Date(),
      })
    }
  }, [isAuthenticated, convexThreadId, createMessage, createThread, updateThread, threadId])

  const { messages, input, status, setInput, setMessages, append, stop, reload, error } = useChat({
    // Point the AI SDK to your new Convex HTTP Action endpoint
    api: getConvexHttpUrl("/api/chat"),
    id: threadId,
    initialMessages,
    experimental_throttle: 50,
    onFinish: async ({ parts }) => {
      const aiMessage: UIMessage = {
        id: uuidv4(),
        parts: parts as UIMessage["parts"],
        role: "assistant",
        content: "",
        createdAt: new Date(),
      }

      await saveMessage(aiMessage)
    },
    // Pass model and userApiKey directly in the body for the Convex action to use
    body: {
      model: selectedModel,
      userApiKey: userApiKeyForModel, // Pass the user's API key if available
    },
    // No need for custom headers for API keys here, as it's now in the body
  })

  return (
    <div className="relative w-full h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <div className="w-full max-w-3xl pt-10 pb-44 mx-auto px-4">
          <Messages
            threadId={threadId}
            messages={messages}
            status={status}
            setMessages={setMessages}
            reload={reload}
            error={error}
            stop={stop}
          />
        </div>
      </main>
      <div className="absolute bottom-0 left-0 right-11">
        <div className="w-full max-w-3xl mx-auto px-4 pb-4">
          <ChatInput threadId={threadId} input={input} status={status} append={append} setInput={setInput} stop={stop} />
        </div>
      </div>
      
      <div className="fixed right-4 top-4 z-20 flex gap-2">
        <ThemeToggle />
      </div>
    </div>
  )
}
