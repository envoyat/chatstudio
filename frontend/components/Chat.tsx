"use client"

import { useChat } from "@ai-sdk/react"
import Messages from "./Messages"
import ChatInput from "./ChatInput"
import type { UIMessage } from "ai"
import { v4 as uuidv4 } from "uuid"
import { useCreateMessage } from "@/frontend/storage/convex-queries"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { useModelStore } from "@/frontend/stores/ModelStore"
import { getEffectiveModelConfig } from "@/lib/models"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import type { Id } from "../../convex/_generated/dataModel"

interface ChatProps {
  threadId: string
  initialMessages: UIMessage[]
}

export default function Chat({ threadId, initialMessages }: ChatProps) {
  const { getKey, hasUserKey } = useAPIKeyStore()
  const selectedModel = useModelStore((state) => state.selectedModel)
  const createMessageMutation = useCreateMessage()
  
  // Compute effective model config directly in component to avoid infinite loop
  const modelConfig = getEffectiveModelConfig(selectedModel, getKey, hasUserKey)

  const { messages, input, status, setInput, setMessages, append, stop, reload, error } = useChat({
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

      try {
        await createMessageMutation({
          threadId: threadId as Id<"threads">,
          messageId: aiMessage.id,
          parts: aiMessage.parts,
          content: aiMessage.content,
          role: aiMessage.role,
          createdAt: aiMessage.createdAt?.getTime() || Date.now(),
        })
      } catch (error) {
        console.error(error)
      }
    },
    headers: {
      // Only send user's API key if they have one, let server handle host key fallback
      ...(hasUserKey(modelConfig.provider) ? { [modelConfig.headerKey]: getKey(modelConfig.provider) || "" } : {}),
    },
    body: {
      model: selectedModel,
    },
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
