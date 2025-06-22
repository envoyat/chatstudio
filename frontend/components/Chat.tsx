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
import { useUser } from "@clerk/nextjs"
import type { Id } from "@/convex/_generated/dataModel"
import { MESSAGE_ROLES } from "@/convex/constants"
import { Button } from "@/components/ui/button"
import { ArrowDown } from "lucide-react"

interface ChatProps {
  threadId: string // UUID from URL
}

export default function Chat({ threadId: initialThreadUuid }: ChatProps) {
  const selectedModel = useModelStore((state) => state.selectedModel)
  
  const [convexConversationId, setConvexConversationId] = useState<Id<"conversations"> | null>(null)
  const { isAuthenticated } = useConvexAuth()
  const { user } = useUser();
  const scrollContainerRef = useRef<HTMLElement>(null)
  const chatInputWrapperRef = useRef<HTMLDivElement>(null)
  const lastScrollTopRef = useRef<number>(0)

  // State to determine if the user is just a viewer of a public chat
  const [isViewerMode, setIsViewerMode] = useState(false);
  
  const [chatInputHeight, setChatInputHeight] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Find the Convex thread ID from the URL's UUID.
  const conversation = useConversationByUuid(initialThreadUuid)
  
  useEffect(() => {
    if (conversation) {
      setConvexConversationId(conversation._id);

      // Determine if the user is a viewer. This is true if the chat is public
      // and the current user is not the owner.
      const isOwner = isAuthenticated && user && conversation.userId === user.id;
      const isPublicViewer = (conversation.isPublic ?? false) && !isOwner;
      setIsViewerMode(isPublicViewer);

    } else {
      setConvexConversationId(null);
      setIsViewerMode(false);
    }
  }, [conversation, initialThreadUuid, isAuthenticated, user]);

  // Reactively fetch messages for the current thread from Convex.
  const convexMessages = useMessagesByUuid(initialThreadUuid)

  // Memoize the conversion from Convex doc format to the UI's UIMessage format.
  const messages: UIMessage[] = useMemo(() => {
    if (!convexMessages) return []
    return convexMessages.map((msg) => {
      const data: Record<string, any> = {
        reasoning: msg.reasoning, // Pass through the new reasoning field
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
          // Handle reasoning parts
          else if (part.type === 'reasoning') {
            return {
              type: 'reasoning',
              text: part.text,
            };
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
  }, [convexMessages])

  // Count tokens in messages and update store
  useTokenCounter(messages);
  
  // Determine if the last message is an assistant response that's still streaming.
  const isStreaming = useMemo(() => {
    if (!messages || messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    const messageData = lastMessage.data as { isComplete?: boolean } | undefined;
    return lastMessage.role === MESSAGE_ROLES.ASSISTANT && messageData?.isComplete === false;
  }, [messages]);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    }
  };

  const handleScrollToBottomClick = () => {
    setAutoScroll(true);
    // Give it a moment for the state to update before scrolling, 
    // or just call scrollToBottom directly for immediate feedback.
    scrollToBottom('smooth');
  };

  // Auto-scroll on new messages
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom('auto');
    }
  }, [messages, autoScroll]);

  // Scroll event listeners for button visibility and user interaction
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;
      
      // Check if user scrolled up - cancel auto-scroll immediately
      if (scrollTop < lastScrollTopRef.current && autoScroll) {
        setAutoScroll(false);
      }
      
      // Update the last scroll position
      lastScrollTopRef.current = scrollTop;
      
      setShowScrollButton(!isAtBottom);
      
      if (isAtBottom) {
        setAutoScroll(true);
      }
    };

    const handleUserInteraction = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight > 150) {
        setAutoScroll(false);
      }
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('wheel', handleUserInteraction, { passive: true });
    container.addEventListener('touchstart', handleUserInteraction, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleUserInteraction);
      container.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [scrollContainerRef.current, autoScroll]);

  // Observer to track ChatInput height for button positioning
  useEffect(() => {
    const element = chatInputWrapperRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      // Use offsetHeight to get the full height including padding and border
      setChatInputHeight(element.offsetHeight);
    });

    observer.observe(element);
    // Set initial height to avoid a flicker
    setChatInputHeight(element.offsetHeight);

    return () => {
      // Ensure we unobserve the element on cleanup
      observer.unobserve(element);
    };
  }, []);
  return (
    <div className="relative w-full h-screen flex">
      {/* Main content area */}
      <div className="flex-1 flex flex-col relative">
        <main 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto relative no-scrollbar"
        >
          {/* Custom scroll indicator */}
          <ScrollIndicator containerRef={scrollContainerRef} />
          
          <div className="w-full max-w-3xl mx-auto px-4 min-h-full flex flex-col">
            {/* Messages */}
            <div className="flex-1 pt-10">
              <Messages
                messages={messages}
                isStreaming={isStreaming}
                convexConversationId={convexConversationId}
              />
            </div>
            
            {/* Sticky ChatInput at bottom - only show if authenticated or public */}
            <div className="sticky bottom-0 pb-4" ref={chatInputWrapperRef}>
              <ChatInput
                threadId={initialThreadUuid}
                convexConversationId={convexConversationId}
                onConvexConversationIdChange={setConvexConversationId}
                isStreaming={isStreaming}
                isAuthenticated={isAuthenticated}
                messages={messages}
                isViewerMode={isViewerMode}
              />
            </div>
          </div>
        </main>
        
        {/* Scroll to bottom button */}
        {showScrollButton && (
          <Button
            onClick={handleScrollToBottomClick}
            variant="outline"
            size="icon"
            className="absolute z-10 h-10 w-10 rounded-full shadow-md bg-background/80 backdrop-blur-sm left-1/2 -translate-x-1/2 transition-all duration-200"
            style={{ bottom: `${chatInputHeight + 8}px` }} // 8px spacing above the input area
          >
            <ArrowDown className="h-5 w-5" />
          </Button>
        )}
      </div>
      
      {/* Settings panel - only show if authenticated */}
      {isAuthenticated && (
        <ChatRunSettings conversationId={convexConversationId} messages={messages} />
      )}
    </div>
  )
}
