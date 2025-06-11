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
import { useState, useCallback, useEffect, useRef } from "react"
import { useConvexAuth } from "convex/react"
import { getConvexHttpUrl } from "@/lib/utils"
import type { Id } from "@/convex/_generated/dataModel"

interface ChatProps {
  threadId: string // This is the UUID from the URL, used for client-side routing/storage
  initialMessages: UIMessage[]
}

export default function Chat({ threadId: initialThreadUuid, initialMessages }: ChatProps) {
  const { getKey, hasUserKey } = useAPIKeyStore()
  const selectedModel = useModelStore((state) => state.selectedModel)
  
  // currentConvexThreadId will store the actual Convex `_id` once resolved
  const [currentConvexThreadId, setCurrentConvexThreadId] = useState<Id<"threads"> | null>(null);
  const { isAuthenticated } = useConvexAuth()
  
  // Convex queries and mutations
  // Use `initialThreadUuid` (from URL) to find existing thread in Convex
  const existingThread = useThreadByUuid(isAuthenticated ? initialThreadUuid : undefined);
  const createMessageMutation = useCreateMessage();
  const createThreadMutation = useCreateThread();
  const updateThreadMutation = useUpdateThread();
  
  // Resolve currentConvexThreadId from existingThread, or null if new/unauthenticated
  useEffect(() => {
    if (isAuthenticated) {
      if (existingThread) {
        setCurrentConvexThreadId(existingThread._id);
      } else {
        // If authenticated but no existing thread for this UUID, it's a new authenticated chat
        setCurrentConvexThreadId(null); 
      }
    } else {
      // Unauthenticated, no Convex _id
      setCurrentConvexThreadId(null);
    }
  }, [isAuthenticated, existingThread, initialThreadUuid]);
  
  // Determine if a user key is available for the selected model's provider
  // This will be passed to the Convex HTTP action.
  const modelConfig = getEffectiveModelConfig(selectedModel, getKey, hasUserKey);
  const userApiKeyForModel = hasUserKey(modelConfig.provider) ? getKey(modelConfig.provider) : undefined;

  // Store the _id of the last assistant message received from Convex
  const lastConvexAssistantMessageIdRef = useRef<Id<"messages"> | null>(null);

  const saveAIMessageToConvex = useCallback(async (aiMessageContent: string, parts: UIMessage["parts"]) => {
    if (!isAuthenticated || !currentConvexThreadId) {
      // Unauthenticated users or no thread created yet (e.g., first message not user's)
      console.warn("Skipping AI message persistence: Not authenticated or no thread ID.");
      return;
    }

    try {
      const messageDbId = await createMessageMutation({
        threadId: currentConvexThreadId,
        content: aiMessageContent,
        role: "assistant",
        parts: parts || [], // Provide default empty array if parts is undefined
      });
      lastConvexAssistantMessageIdRef.current = messageDbId;

      await updateThreadMutation({
        threadId: currentConvexThreadId,
        lastMessageAt: Date.now(),
      });
    } catch (error) {
      console.error("Failed to save AI message to Convex:", error);
      // Potentially show a toast error to the user
    }
  }, [isAuthenticated, currentConvexThreadId, createMessageMutation, updateThreadMutation]);

  const { messages, input, status, setInput, setMessages, append, stop, reload, error } = useChat({
    api: getConvexHttpUrl("/api/chat"), // Point AI SDK to Convex HTTP action
    id: initialThreadUuid, // The ID passed to useChat is the `id` for AI SDK internal caching
    initialMessages,
    experimental_throttle: 50,
    onFinish: async ({ parts, content }) => {
      // The AI SDK's `content` property might be partial during streaming.
      // `parts` should contain the full content after `onFinish`.
      const messageParts = parts || [];
      const fullContent = messageParts
        .filter(p => p.type === 'text')
        .map(p => (p as { text: string }).text)
        .join('');
      
      if (fullContent.trim()) {
        // Save the *final, complete* AI message content to Convex
        await saveAIMessageToConvex(fullContent, messageParts);
      }
    },
    body: {
      model: selectedModel,
      userApiKey: userApiKeyForModel, // Pass the user's API key if available
    },
  });

  return (
    <div className="relative w-full h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <div className="w-full max-w-3xl pt-10 pb-44 mx-auto px-4">
          <Messages
            threadId={initialThreadUuid} // Still use the UUID for Messages component
            messages={messages}
            status={status}
            setMessages={setMessages}
            reload={reload}
            error={error}
            stop={stop}
            convexThreadId={currentConvexThreadId} // Renamed from initialConvexThreadId
          />
        </div>
      </main>
      <div className="absolute bottom-0 left-0 right-11">
        <div className="w-full max-w-3xl mx-auto px-4 pb-4">
          <ChatInput
            threadId={initialThreadUuid} // Still pass the UUID from URL for local routing/storage
            input={input}
            status={status}
            append={append}
            setInput={setInput}
            stop={stop}
            convexThreadId={currentConvexThreadId}
            onConvexThreadIdChange={setCurrentConvexThreadId} // Renamed from setCurrentConvexThreadId
          />
        </div>
      </div>
      
      <div className="fixed right-4 top-4 z-20 flex gap-2">
        <ThemeToggle />
      </div>
    </div>
  )
}
