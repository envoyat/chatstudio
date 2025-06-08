"use client"

import { useChat } from "@ai-sdk/react"
import Messages from "./Messages"
import ChatInput from "./ChatInput"
import ChatNavigator from "./ChatNavigator"
import type { UIMessage } from "ai"
import { v4 as uuidv4 } from "uuid"
import { createMessage } from "@/frontend/storage/queries"
import { triggerUpdate } from "@/frontend/hooks/useLiveQuery"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { useModelStore } from "@/frontend/stores/ModelStore"
import { Button } from "@/components/ui/button"
import { MessageSquareMore } from "lucide-react"
import { useChatNavigator } from "@/frontend/hooks/useChatNavigator"
import { ThemeToggle } from "@/components/ui/theme-toggle"

interface ChatProps {
  threadId: string
  initialMessages: UIMessage[]
}

export default function Chat({ threadId, initialMessages }: ChatProps) {
  const { getKey } = useAPIKeyStore()
  const selectedModel = useModelStore((state) => state.selectedModel)
  const modelConfig = useModelStore((state) => state.getModelConfig())

  const { isNavigatorVisible, handleToggleNavigator, closeNavigator, registerRef, scrollToMessage } = useChatNavigator()

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
        await createMessage(threadId, aiMessage)
        triggerUpdate()
      } catch (error) {
        console.error(error)
      }
    },
    headers: {
      [modelConfig.headerKey]: getKey(modelConfig.provider) || "",
    },
    body: {
      model: selectedModel,
    },
  })

  return (
    <div className="relative w-full">
      <main className={`flex flex-col w-full max-w-3xl pt-10 pb-44 mx-auto transition-all duration-300 ease-in-out`}>
        <Messages
          threadId={threadId}
          messages={messages}
          status={status}
          setMessages={setMessages}
          reload={reload}
          error={error}
          registerRef={registerRef}
          stop={stop}
        />
        <ChatInput threadId={threadId} input={input} status={status} append={append} setInput={setInput} stop={stop} />
      </main>
      
      <div className="fixed right-4 top-4 z-20 flex gap-2">
        <ThemeToggle />
        <Button
          onClick={handleToggleNavigator}
          variant="outline"
          size="icon"
          aria-label={isNavigatorVisible ? "Hide message navigator" : "Show message navigator"}
        >
          <MessageSquareMore className="h-5 w-5" />
        </Button>
      </div>

      <ChatNavigator
        threadId={threadId}
        scrollToMessage={scrollToMessage}
        isVisible={isNavigatorVisible}
        onClose={closeNavigator}
      />
    </div>
  )
}
