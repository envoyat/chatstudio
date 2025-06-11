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
import type { Id } from "@/convex/_generated/dataModel"; // Import Convex Id type

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

  const saveMessage = useCallback(async (message: UIMessage) => {
    let messageDbId: string | Id<"messages"> | undefined; // To store the ID (Convex _id or local UUID)
    let threadDbId: Id<"threads"> | string | undefined; // To store the effective thread ID for DB

    if (isAuthenticated) {
      // For authenticated users, ensure we have a Convex thread ID
      if (!currentConvexThreadId && message.role === "user") {
        // This is the first user message in a new authenticated thread.
        // Create the Convex thread and capture its `_id`.
        try {
          const newConvexThreadId = await createThreadMutation({
            title: message.content.slice(0, 50) + "...",
            uuid: initialThreadUuid, // Use the client-generated UUID as the Convex thread's UUID
          });
          setCurrentConvexThreadId(newConvexThreadId); // Update state to reflect the new Convex ID
          threadDbId = newConvexThreadId;
        } catch (error) {
          console.error("Failed to create Convex thread:", error);
          return; // Stop if thread creation fails
        }
      } else if (currentConvexThreadId) {
        // If we already have a Convex thread ID, use it.
        threadDbId = currentConvexThreadId;
      } else {
        // This case should ideally not happen if state is correctly managed.
        console.error("Authenticated: Cannot determine thread ID for message save.");
        return;
      }

      try {
        messageDbId = await createMessageMutation({
          threadId: threadDbId as Id<"threads">, // Ensure it's a Convex Id
          content: message.content,
          role: message.role,
          parts: message.parts,
        });

        await updateThreadMutation({
          threadId: threadDbId as Id<"threads">, // Ensure it's a Convex Id
          lastMessageAt: Date.now(),
        });
      } catch (error) {
        console.error("Failed to save message to Convex:", error);
      }
    } else {
      // Unauthenticated: use local storage
      threadDbId = initialThreadUuid; // Local storage uses the UUID directly
      // `ChatInput` will handle local thread creation if `isNewThreadRoute` is true.
      memoryStorage.addMessage({
        _id: message.id as any, // Not a real Convex ID, but for compatibility with local storage
        id: message.id, // Use the AI SDK UIMessage ID as local ID
        threadId: initialThreadUuid, // Use the UUID
        content: message.content,
        role: message.role,
        parts: message.parts,
        createdAt: message.createdAt || new Date(),
      });
      messageDbId = message.id; // For local storage, messageDbId is the UUID
    }
    return messageDbId; // Return the created message ID (Convex or UUID)
  }, [isAuthenticated, currentConvexThreadId, createMessageMutation, createThreadMutation, updateThreadMutation, initialThreadUuid]);

  const { messages, input, status, setInput, setMessages, append, stop, reload, error } = useChat({
    api: getConvexHttpUrl("/api/chat"), // Point AI SDK to Convex HTTP action
    id: initialThreadUuid, // The ID passed to useChat is the `id` for AI SDK internal caching
    initialMessages,
    experimental_throttle: 50,
    onFinish: async ({ parts }) => {
      const aiMessage: UIMessage = {
        id: uuidv4(), // AI SDK client-side ID for this message
        parts: parts as UIMessage["parts"],
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };
      // Save the AI message, and get its DB ID (Convex _id or local UUID).
      // We don't directly use this returned ID here, but it's important that `saveMessage`
      // correctly creates the DB entry.
      await saveMessage(aiMessage);
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
            // Pass the Convex thread ID if available for authenticated flows
            convexThreadId={currentConvexThreadId}
          />
        </div>
      </div>
      
      <div className="fixed right-4 top-4 z-20 flex gap-2">
        <ThemeToggle />
      </div>
    </div>
  )
}
