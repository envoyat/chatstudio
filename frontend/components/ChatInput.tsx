"use client"

import type React from "react"

import { ChevronDown, Check, ArrowUpIcon } from "lucide-react"
import { memo, useCallback, useMemo } from "react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import useAutoResizeTextarea from "@/hooks/useAutoResizeTextArea"
import type { UseChatHelpers } from "@ai-sdk/react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { useModelStore } from "@/frontend/stores/ModelStore"
import { AI_MODELS, type AIModel, getEffectiveModelConfig, isModelAvailable } from "@/lib/models"
import KeyPrompt from "@/frontend/components/KeyPrompt"
import type { UIMessage } from "ai"
import { v4 as uuidv4 } from "uuid"
import { StopIcon } from "@/components/ui/icons"
import { useMessageSummary } from "../hooks/useMessageSummary"

// New imports for Convex
import { useConvexAuth } from "convex/react"
import { useCreateMessage, useCreateThread } from "@/lib/convex-hooks";
import type { Id } from "@/convex/_generated/dataModel"; // Import Convex Id type

interface ChatInputProps {
  threadId: string // This is the UUID from the URL, used for client-side routing/storage
  input: UseChatHelpers["input"]
  status: UseChatHelpers["status"]
  setInput: UseChatHelpers["setInput"]
  append: UseChatHelpers["append"]
  stop: UseChatHelpers["stop"]
  convexThreadId: Id<"threads"> | null; // New prop: Convex thread ID if available
  onConvexThreadIdChange: React.Dispatch<React.SetStateAction<Id<"threads"> | null>>; // New prop for updating convex thread ID
}

interface StopButtonProps {
  stop: UseChatHelpers["stop"]
}

interface SendButtonProps {
  onSubmit: () => void
  disabled: boolean
}

const createUserMessage = (id: string, text: string): UIMessage => ({
  id,
  parts: [{ type: "text", text }],
  role: "user",
  content: text,
  createdAt: new Date(),
})

function PureChatInput({ threadId, input, status, setInput, append, stop, convexThreadId, onConvexThreadIdChange }: ChatInputProps) {
  const canChat = useAPIKeyStore((state) => state.hasRequiredKeys())

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 72,
    maxHeight: 200,
  })

  const navigate = useNavigate()
  const location = useLocation()

  const isDisabled = useMemo(() => !input.trim() || status === "streaming" || status === "submitted", [input, status])

  const { isAuthenticated } = useConvexAuth(); // Get authentication status
  const convexCreateThread = useCreateThread(); // Convex mutation for creating threads
  const convexCreateMessage = useCreateMessage(); // Convex mutation for creating messages
  const { complete } = useMessageSummary(); // Hook for message summary/title generation

  const handleSubmit = useCallback(async () => {
    const currentInput = textareaRef.current?.value || input;
    if (!currentInput.trim() || isDisabled) return;

    const uiMessageId = uuidv4(); // Client-side UUID for AI SDK UIMessage

    let messageDbId: string | Id<"messages"> | undefined; // Actual ID saved to DB (Convex Id or local UUID)
    let threadDbId: Id<"threads"> | string | undefined; // Actual thread ID saved to DB (Convex Id or local UUID)

    const isNewThreadRoute = location.pathname === "/" || location.pathname === "/chat";

    if (isAuthenticated) {
      // Authenticated flow: use Convex DB
      if (isNewThreadRoute || !convexThreadId) {
        // If it's a new chat session OR a new thread for an existing UUID (e.g. first message in a non-saved chat)
        const newConvexThreadId = await convexCreateThread({
          title: currentInput.trim().slice(0, 50) + "...",
          uuid: threadId, // Use the client-generated UUID from URL as the Convex thread's UUID
        });
        threadDbId = newConvexThreadId;
        onConvexThreadIdChange(newConvexThreadId); // Update the convex thread ID in parent component
        // Navigate if it was a new chat session before saving to DB
        if (isNewThreadRoute) {
          navigate(`/chat/${threadId}`);
        }
      } else {
        threadDbId = convexThreadId; // Use the provided Convex thread ID
      }

      // Create message in Convex and capture its Convex ID
      messageDbId = await convexCreateMessage({
        threadId: threadDbId as Id<"threads">, // Ensure it's Convex Id
        content: currentInput.trim(),
        role: "user",
        parts: [{ type: "text", text: currentInput.trim() }],
      });

    } else {
      // Unauthenticated flow: ephemeral chat (no persistence)
      threadDbId = threadId; // Use UUID for UI purposes only
      if (isNewThreadRoute) {
        navigate(`/chat/${threadId}`);
      }
      messageDbId = uiMessageId; // Use UI message ID
    }

    const userMessage = createUserMessage(uiMessageId, currentInput.trim());
    append(userMessage); // Append to AI SDK messages
    setInput("");
    adjustHeight(true);

    // Call message summary with the correct database IDs (Convex IDs or local UUIDs)
    if (messageDbId && threadDbId) {
      complete(currentInput.trim(), {
        body: {
          messageId: uiMessageId, // Always pass the AI SDK UI ID for `useMessageSummary`'s general logic
          threadId: threadId,     // Always pass the AI SDK UI thread ID for `useMessageSummary`'s general logic
          isTitle: isNewThreadRoute,
          // Pass Convex IDs ONLY if authenticated
          ...(isAuthenticated && messageDbId && threadDbId && {
            convexMessageId: messageDbId as Id<"messages">,
            convexThreadId: threadDbId as Id<"threads">,
          }),
        },
      });
    }
  }, [input, isDisabled, setInput, adjustHeight, append, textareaRef, threadId, complete, navigate, location, isAuthenticated, convexThreadId, convexCreateThread, convexCreateMessage, onConvexThreadIdChange])

  if (!canChat) {
    return <KeyPrompt />
  }

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
    <div className="fixed bottom-0 w-full max-w-3xl">
      <div className="bg-secondary rounded-t-[20px] p-2 pb-0 w-full">
        <div className="relative">
          <div className="flex flex-col">
            <div className="bg-secondary overflow-y-auto max-h-[300px]">
              <Textarea
                id="chat-input"
                value={input}
                placeholder="What can I do for you?"
                className={cn(
                  "w-full px-4 py-3 border-none shadow-none bg-transparent",
                  "placeholder:text-muted-foreground resize-none",
                  "focus-visible:ring-0 focus-visible:ring-offset-0",
                  "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30",
                  "scrollbar-thumb-rounded-full",
                  "min-h-[72px]",
                )}
                ref={textareaRef}
                onKeyDown={handleKeyDown}
                onChange={handleInputChange}
                aria-label="Chat message input"
                aria-describedby="chat-input-description"
              />
              <span id="chat-input-description" className="sr-only">
                Press Enter to send, Shift+Enter for new line
              </span>
            </div>

            <div className="h-14 flex items-center px-2">
              <div className="flex items-center justify-between w-full">
                <ChatModelDropdown />

                {status === "submitted" || status === "streaming" ? (
                  <StopButton stop={stop} />
                ) : (
                  <SendButton onSubmit={handleSubmit} disabled={isDisabled} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ChatInput = memo(PureChatInput, (prevProps, nextProps) => {
  if (prevProps.input !== nextProps.input) return false
  if (prevProps.status !== nextProps.status) return false
  if (prevProps.convexThreadId !== nextProps.convexThreadId) return false // Include new prop in memoization
  return true
})

const PureChatModelDropdown = () => {
  const getKey = useAPIKeyStore((state) => state.getKey)
  const { selectedModel, setModel } = useModelStore()

  const isModelEnabled = useCallback(
    (model: AIModel) => {
      return isModelAvailable(model, getKey)
    },
    [getKey],
  )

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-1 h-8 pl-2 pr-2 text-xs rounded-md text-foreground hover:bg-primary/10 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-blue-500"
            aria-label={`Selected model: ${selectedModel}`}
          >
            <div className="flex items-center gap-1">
              {selectedModel}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className={cn("min-w-[10rem]", "border-border", "bg-popover")}>
          {AI_MODELS.map((model) => {
            const isEnabled = isModelEnabled(model)
            return (
              <DropdownMenuItem
                key={model}
                onSelect={() => isEnabled && setModel(model)}
                disabled={!isEnabled}
                className={cn("flex items-center justify-between gap-2", "cursor-pointer")}
              >
                <span>{model}</span>
                {selectedModel === model && <Check className="w-4 h-4 text-blue-500" aria-label="Selected" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

const ChatModelDropdown = memo(PureChatModelDropdown)

function PureStopButton({ stop }: StopButtonProps) {
  return (
    <Button variant="outline" size="icon" onClick={stop} aria-label="Stop generating response">
      <StopIcon size={20} />
    </Button>
  )
}

const StopButton = memo(PureStopButton)

const PureSendButton = ({ onSubmit, disabled }: SendButtonProps) => {
  return (
    <Button onClick={onSubmit} variant="default" size="icon" disabled={disabled} aria-label="Send message">
      <ArrowUpIcon size={18} />
    </Button>
  )
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  return prevProps.disabled === nextProps.disabled
})

export default ChatInput
