"use client"

import Messages from "./Messages"
import ChatInput from "./ChatInput"
import ChatRunSettings from "./ChatRunSettings"
import type { UIMessage } from "ai"
import { useModelStore } from "@/frontend/stores/ModelStore"
import { useChatRunSettingsStore } from "@/frontend/stores/ChatRunSettingsStore"
import { useCreateThread, useThreadByUuid, useMessagesByUuid } from "@/lib/convex-hooks"
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
  
  const [convexThreadId, setConvexThreadId] = useState<Id<"threads"> | null>(null)
  const { isAuthenticated } = useConvexAuth()

  // Find the Convex thread ID from the URL's UUID.
  const existingThread = useThreadByUuid(isAuthenticated ? initialThreadUuid : undefined)
  
  useEffect(() => {
    if (isAuthenticated && existingThread) {
      setConvexThreadId(existingThread._id);
    } else {
      setConvexThreadId(null);
    }
  }, [isAuthenticated, existingThread, initialThreadUuid]);

  // Reactively fetch messages for the current thread from Convex.
  const convexMessages = useMessagesByUuid(isAuthenticated ? initialThreadUuid : undefined)

  // Memoize the conversion from Convex doc format to the UI's UIMessage format.
  const messages: UIMessage[] = useMemo(() => {
    if (!isAuthenticated || !convexMessages) return []
    return convexMessages.map((msg) => ({
      id: msg._id,
      role: msg.role,
      content: msg.content,
      parts: msg.parts || [{ type: "text", text: msg.content }],
      createdAt: new Date(msg.createdAt),
      // NEW: Pass the streaming status to the UI component
      data: { isComplete: msg.isComplete ?? true },
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
      {/* ChatRunSettings positioned absolutely in top right corner */}
      <ChatRunSettings />
      
      <main className="flex-1 overflow-y-auto">
        <div className="w-full max-w-3xl pt-10 pb-44 mx-auto px-4">
          <Messages
            messages={messages}
            isStreaming={isStreaming}
            convexThreadId={convexThreadId}
          />
        </div>
      </main>
      <div className="absolute bottom-0 left-0 right-11">
        <div className="w-full max-w-3xl mx-auto px-4 pb-4">
          <ChatInput
            threadId={initialThreadUuid}
            convexThreadId={convexThreadId}
            onConvexThreadIdChange={setConvexThreadId}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  )
}
