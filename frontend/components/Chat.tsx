"use client"

import Messages from "./Messages"
import ChatInput from "./ChatInput"
import ChatRunSettings from "./ChatRunSettings"
import ScrollIndicator from "./ScrollIndicator"
import type { UIMessage } from "ai"
import { useModelStore } from "@/frontend/stores/ModelStore"
import { useConversationByUuid, useMessagesByUuid } from "@/lib/convex-hooks"
import { useTokenCounter } from "@/frontend/hooks/useTokenCounter"
import { useState, useMemo, useEffect, useRef } from "react"
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
  const scrollContainerRef = useRef<HTMLElement>(null)

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
    return convexMessages.map((msg) => {
      const data: Record<string, any> = {
        isComplete: msg.isComplete ?? true,
      };
      
      if (msg.toolCalls) {
        data.toolCalls = msg.toolCalls;
      }
      
      if (msg.toolOutputs) {
        data.toolOutputs = msg.toolOutputs;
      }
      
      // Transform parts to match AI SDK's expected types
      let parts: any[] = [];
      if (msg.parts && msg.parts.length > 0) {
        parts = msg.parts.map((part: any) => {
          // Handle tool-call parts by converting to tool-invocation
          if (part.type === 'tool-call') {
            return {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: part.id,
                toolName: part.name,
                args: part.args,
              }
            };
          }
          // Handle tool-result parts by converting to tool-invocation
          else if (part.type === 'tool-result') {
            return {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: part.toolCallId,
                toolName: '', // We don't have the tool name in the result
                args: {},
                result: part.result,
              }
            };
          }
          // Handle image parts - pass through as-is for our custom rendering
          else if (part.type === 'image') {
            return part; // Keep image parts intact
          }
          // Pass through other part types as-is
          return part;
        });
      } else {
        // Fallback to text part if no parts are provided
        parts = [{ type: "text", text: msg.content }];
      }
      
      return {
        id: msg._id,
        role: msg.role as "user" | "assistant" | "system" | "data",
        content: msg.content,
        parts,
        createdAt: new Date(msg.createdAt),
        data,
      };
    })
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
    <div className="relative w-full h-screen flex">
      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        <main 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto relative no-scrollbar"
        >
          {/* Custom scroll indicator */}
          <ScrollIndicator containerRef={scrollContainerRef} />
          
          <div className="w-full max-w-3xl mx-auto px-4 min-h-full flex flex-col">
            {/* Messages with padding to account for sticky input */}
            <div className="flex-1 pt-10 pb-32">
              <Messages
                messages={messages}
                isStreaming={isStreaming}
                convexConversationId={convexConversationId}
              />
            </div>
            
            {/* Sticky ChatInput at bottom */}
            <div className="sticky bottom-0 pb-4">
              <ChatInput
                threadId={initialThreadUuid}
                convexConversationId={convexConversationId}
                onConvexConversationIdChange={setConvexConversationId}
                isStreaming={isStreaming}
              />
            </div>
          </div>
        </main>
      </div>
      
      {/* Settings panel - shifts content on desktop, overlays on mobile */}
      <ChatRunSettings />
    </div>
  )
}
