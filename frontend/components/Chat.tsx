"use client"

import Messages from "./Messages"
import ChatInput from "./ChatInput"
import ChatRunSettings from "./ChatRunSettings"
import type { UIMessage } from "ai"
import { useModelStore } from "@/frontend/stores/ModelStore"
import { useChatRunSettingsStore } from "@/frontend/stores/ChatRunSettingsStore"
import { useCreateConversation, useConversationByUuid, useMessagesByUuid } from "@/lib/convex-hooks"
import { useTokenCounter } from "@/frontend/hooks/useTokenCounter"
import { useState, useMemo, useEffect } from "react"
import { useConvexAuth } from "convex/react"
import type { Id } from "@/convex/_generated/dataModel"
import { MESSAGE_ROLES } from "@/convex/constants"

interface ChatProps {
  threadId: string // UUID from URL
}

export default function Chat({ threadId: initialThreadUuid }: ChatProps) {
  const selectedModel = useModelStore((state) => state.selectedModel)
  
  const [convexConversationId, setConvexConversationId] = useState<Id<"conversations"> | null>(null)
  const { isAuthenticated } = useConvexAuth()

  // Find the Convex thread ID from the URL's UUID.
  const existingThread = useConversationByUuid(isAuthenticated ? initialThreadUuid : undefined)
  
  useEffect(() => {
    if (isAuthenticated && existingThread) {
      setConvexConversationId(existingThread._id);
    } else {
      setConvexConversationId(null);
    }
  }, [isAuthenticated, existingThread, initialThreadUuid]);

  // Reactively fetch messages for the current thread from Convex.
  const convexMessages = useMessagesByUuid(isAuthenticated ? initialThreadUuid : undefined)

  // Memoize the conversion from Convex doc format to the UI's UIMessage format.
  const messages: UIMessage[] = useMemo(() => {
    if (!isAuthenticated || !convexMessages) return []
    return convexMessages.map((msg) => ({
      id: msg._id,
      role: msg.role as "user" | "assistant" | "system" | "data",
      content: msg.content,
      parts: msg.parts || [{ type: "text", text: msg.content }],
      createdAt: new Date(msg.createdAt),
      data: { 
        isComplete: msg.isComplete ?? true,
        toolCalls: msg.toolCalls,
        toolOutputs: msg.toolOutputs,
      },
    }))
  }, [convexMessages, isAuthenticated])

  // Count tokens in messages and update store
  useTokenCounter(messages);
  
  // Determine if the last message is an assistant response that's still streaming.
  const isStreaming = useMemo(() => {
    if (!messages || messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    const messageData = lastMessage.data as { isComplete?: boolean } | undefined;
    return lastMessage.role === MESSAGE_ROLES.ASSISTANT && messageData?.isComplete === false;
  }, [messages]);

  return (
    <div className="relative w-full h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <div className="w-full max-w-3xl pt-10 pb-44 mx-auto px-4">
          <Messages
            messages={messages}
            isStreaming={isStreaming}
            convexConversationId={convexConversationId}
          />
        </div>
      </main>
      <div className="absolute bottom-0 left-0 right-11">
        <div className="w-full max-w-3xl mx-auto px-4 pb-4">
          <ChatInput
            threadId={initialThreadUuid}
            convexConversationId={convexConversationId}
            onConvexConversationIdChange={setConvexConversationId}
            isStreaming={isStreaming}
          />
        </div>
      </div>
      
      <ChatRunSettings />
    </div>
  )
}
