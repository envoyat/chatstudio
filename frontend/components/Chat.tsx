"use client"

import { useChat } from "@ai-sdk/react"
import Messages from "./Messages"
import ChatInput from "./ChatInput"
import ChatRunSettings from "./ChatRunSettings"
import type { UIMessage } from "ai"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { useModelStore } from "@/frontend/stores/ModelStore"
import { useChatRunSettingsStore } from "@/frontend/stores/ChatRunSettingsStore"
import { useWebSearchStore } from "@/frontend/stores/WebSearchStore"
import { getEffectiveModelConfig } from "@/lib/models"


import { useCreateMessage, useCreateThread, useUpdateThread, useThreadByUuid } from "@/lib/convex-hooks"
import { useTokenCounter } from "@/frontend/hooks/useTokenCounter"
import { useState, useCallback, useEffect, useRef } from "react"
import { useConvexAuth } from "convex/react"
import { getConvexHttpUrl } from "@/lib/utils"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"

interface ChatProps {
  threadId: string // This is the UUID from the URL, used for client-side routing/storage
  initialMessages: UIMessage[]
}

export default function Chat({ threadId: initialThreadUuid, initialMessages }: ChatProps) {
  const { getKey, hasUserKey } = useAPIKeyStore()
  const selectedModel = useModelStore((state) => state.selectedModel)
  const temperature = useChatRunSettingsStore((state) => state.temperature)
  const isWebSearchEnabled = useWebSearchStore((state) => state.isWebSearchEnabled)
  
  // currentConvexThreadId will store the actual Convex `_id` once resolved
  const [currentConvexThreadId, setCurrentConvexThreadId] = useState<Id<"threads"> | null>(null);
  // Add a ref to hold the latest convexThreadId for immediate access in callbacks
  const currentConvexThreadIdRef = useRef<Id<"threads"> | null>(null);

  const { isAuthenticated } = useConvexAuth()
  
  // Convex queries and mutations
  // Use `initialThreadUuid` (from URL) to find existing thread in Convex
  const existingThread = useThreadByUuid(isAuthenticated ? initialThreadUuid : undefined);
  const createMessageMutation = useCreateMessage();
  const createThreadMutation = useCreateThread(); // Keep this for ChatInput to create new threads
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

  // Update the ref whenever the currentConvexThreadId state changes
  // This ensures the ref always holds the most up-to-date value
  useEffect(() => {
    currentConvexThreadIdRef.current = currentConvexThreadId;
  }, [currentConvexThreadId]);
  
  // Determine if a user key is available for the selected model's provider
  // This will be passed to the Convex HTTP action.
  const modelConfig = getEffectiveModelConfig(selectedModel, getKey, hasUserKey);
  const userApiKeyForModel = hasUserKey(modelConfig.provider) ? getKey(modelConfig.provider) : undefined;

  const saveAIMessageToConvex = useCallback(async (aiMessageContent: string, parts: UIMessage["parts"]) => {
    // Access the latest thread ID directly from the ref
    const latestConvexThreadId = currentConvexThreadIdRef.current;

    if (!isAuthenticated || !latestConvexThreadId) {
      // This warning is for expected behavior (unauthenticated chats not persisting)
      // or if there's a real issue with thread ID availability.
      console.warn("Skipping AI message persistence: Not authenticated or no thread ID available at persistence time.");
      return;
    }

    try {
      const messageDbId = await createMessageMutation({
        threadId: latestConvexThreadId, // Use the ID from the ref
        content: aiMessageContent,
        role: "assistant",
        parts: parts || [], // Provide default empty array if parts is undefined
      });

      await updateThreadMutation({
        threadId: latestConvexThreadId, // Use the ID from the ref
        lastMessageAt: Date.now(),
      });
    } catch (error) {
      console.error("Failed to save AI message to Convex:", error);
      // Provide user feedback
      toast.error("Failed to save AI response to database. Please check your connection.");
    }
  }, [isAuthenticated, createMessageMutation, updateThreadMutation]); // Remove currentConvexThreadId from dependencies

  const { messages, input, status, setInput, setMessages, append, stop, reload, error } = useChat({
    api: getConvexHttpUrl("/api/chat"), // Point AI SDK to Convex HTTP action
    id: initialThreadUuid, // The ID passed to useChat is the `id` for AI SDK internal caching
    initialMessages,
    experimental_throttle: 50,
    onFinish: async ({ parts, content }) => {
      // Prefer `parts` if provided (it contains tokenized segments from the AI SDK).
      // If `parts` is missing, fall back to the `content` string supplied by the SDK.
      const messageParts = parts ?? (content ? [{ type: "text", text: content }] : []);

      // Re-assemble the full textual content from the parts array.
      const fullContent = messageParts
        .filter((p) => p.type === "text")
        .map((p) => (p as { text: string }).text)
        .join("");

      if (fullContent.trim()) {
        // Persist the complete AI message to Convex.
        await saveAIMessageToConvex(fullContent, messageParts);
      }
    },
    body: {
      model: selectedModel,
      temperature: temperature,
      userApiKey: userApiKeyForModel, // Pass the user's API key if available
      webSearchEnabled: isWebSearchEnabled, // Pass web search state
    },
  });

  // Count tokens in messages and update store
  useTokenCounter(messages);

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
      
      <ChatRunSettings />
    </div>
  )
}
