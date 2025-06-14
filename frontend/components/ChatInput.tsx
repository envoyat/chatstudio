"use client"

import type React from "react"
import { memo, useState, useCallback, useMemo } from "react"
import { ChevronDown, Check, ArrowUpIcon } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import useAutoResizeTextarea from "@/hooks/useAutoResizeTextArea"
import { useNavigate, useLocation } from "react-router-dom"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { useModelStore } from "@/frontend/stores/ModelStore"
import { AI_MODELS, type AIModel, isModelAvailable, getModelConfig } from "@/lib/models"
import { useConvexAuth } from "convex/react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useCreateThread } from "@/lib/convex-hooks"
import type { Id } from "@/convex/_generated/dataModel"

interface ChatInputProps {
  threadId: string
  isStreaming: boolean
  convexThreadId: Id<"threads"> | null
  onConvexThreadIdChange: React.Dispatch<React.SetStateAction<Id<"threads"> | null>>
}

function PureChatInput({ threadId, isStreaming, convexThreadId, onConvexThreadIdChange }: ChatInputProps) {
  const [input, setInput] = useState("")
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 72, maxHeight: 200 })
  const navigate = useNavigate()
  const location = useLocation()
  
  const selectedModel = useModelStore((state) => state.selectedModel)
  const { getKey, hasUserKey } = useAPIKeyStore()
  
  const isDisabled = useMemo(() => !input.trim() || isStreaming, [input, isStreaming])
  
  const { isAuthenticated } = useConvexAuth()
  const convexCreateThread = useCreateThread()
  const sendMessage = useMutation(api.messages.send)

  const handleSubmit = useCallback(async () => {
    if (isDisabled) return
    const currentInput = input.trim()
    setInput("")
    adjustHeight(true)

    let currentConvexThreadId = convexThreadId

    if (isAuthenticated) {
      if (!currentConvexThreadId) {
        const newThreadId = await convexCreateThread({
          title: currentInput.slice(0, 50) + "...",
          uuid: threadId,
        })
        currentConvexThreadId = newThreadId
        onConvexThreadIdChange(newThreadId)
        
        const isNewThreadRoute = location.pathname === "/" || location.pathname === "/chat";
        if (isNewThreadRoute) {
          navigate(`/chat/${threadId}`)
        }
      }

      const modelConfig = getModelConfig(selectedModel)
      const userApiKeyForModel = hasUserKey(modelConfig.provider) ? getKey(modelConfig.provider) : undefined
      
      const payload = {
        threadId: currentConvexThreadId,
        content: currentInput,
        model: selectedModel,
        userApiKey: userApiKeyForModel || undefined,
      }

      try {
        await sendMessage(payload)
      } catch (error) {
        console.error("[ChatInput] 'messages.send' mutation call failed:", error)
      }
    } else {
      console.warn("[ChatInput] Attempted to send message while unauthenticated.")
    }
  }, [
    input, isDisabled, sendMessage, convexThreadId, onConvexThreadIdChange,
    isAuthenticated, convexCreateThread, threadId, location.pathname, navigate,
    selectedModel, getKey, hasUserKey, adjustHeight
  ])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    adjustHeight()
  }

  return (
    <div className="fixed bottom-0 w-[92%] max-w-3xl">
      <div className="bg-secondary rounded-t-[20px] p-2 pb-0 w-full">
        <div className="relative">
          <div className="flex flex-col">
            <Textarea
              id="chat-input"
              value={input}
              placeholder="What can I do for you?"
              className="w-full px-4 py-3 border-none shadow-none bg-transparent placeholder:text-muted-foreground resize-none focus-visible:ring-0 focus-visible:ring-offset-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30 scrollbar-thumb-rounded-full min-h-[72px]"
              ref={textareaRef}
              onKeyDown={handleKeyDown}
              onChange={handleInputChange}
              aria-label="Chat message input"
              disabled={isStreaming}
            />
            <div className="h-14 flex items-center px-2">
              <div className="flex items-center justify-between w-full">
                <ChatModelDropdown />
                <Button onClick={handleSubmit} variant="default" size="icon" disabled={isDisabled} aria-label="Send message">
                  <ArrowUpIcon size={18} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ChatInput = memo(PureChatInput)

const PureChatModelDropdown = () => {
  const selectedModel = useModelStore((state) => state.selectedModel)
  const setModel = useModelStore((state) => state.setModel)
  const { getKey } = useAPIKeyStore()

  const availableModels = useMemo(() => {
    return AI_MODELS.filter((model) => isModelAvailable(model, getKey))
  }, [getKey])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium">
          {selectedModel}
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {availableModels.map((model) => (
          <DropdownMenuItem
            key={model}
            onClick={() => setModel(model)}
            className="flex items-center justify-between text-xs"
          >
            <span>{model}</span>
            {selectedModel === model && <Check className="h-3 w-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const ChatModelDropdown = memo(PureChatModelDropdown)

export default ChatInput
