"use client"

import { memo, useState } from "react"
import MarkdownRenderer from "@/frontend/components/MemoizedMarkdown"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import equal from "fast-deep-equal"
import MessageControls from "./MessageControls"
import type { UseChatHelpers } from "@ai-sdk/react"
import MessageEditor from "./MessageEditor"
import MessageReasoning from "./MessageReasoning"
import SearchGrounding from "./SearchGrounding"
import type { Id } from "@/convex/_generated/dataModel"

function PureMessage({
  threadId,
  message,
  setMessages,
  reload,
  isStreaming,
  stop,
  convexThreadId,
}: {
  threadId: string
  message: UIMessage
  setMessages: UseChatHelpers["setMessages"]
  reload: UseChatHelpers["reload"]
  isStreaming: boolean
  stop: UseChatHelpers["stop"]
  convexThreadId: Id<"threads"> | null
}) {
  const [mode, setMode] = useState<"view" | "edit">("view")

  // Extract search grounding data from tool calls
  const searchGroundingData = (() => {
    if (message.role !== "assistant") return null;
    
    // Check if the message has tool calls
    const toolCalls = (message as any).toolInvocations || [];
    const webSearchCalls = toolCalls.filter((call: any) => call.toolName === "webSearch");
    
    if (webSearchCalls.length === 0) return null;

    const queries = webSearchCalls.map((call: any) => call.args?.query).filter(Boolean);
    const groundedSegments: Array<{
      text: string;
      sources: Array<{
        url: string;
        title: string;
        confidence: number;
      }>;
    }> = [];

    // Process web search results to create grounded segments
    webSearchCalls.forEach((call: any) => {
      if (call.result && call.result.results) {
        call.result.results.forEach((result: any) => {
          // Extract the segment that mentions this result
          const confidence = result.score ? parseFloat(result.score) * 100 : 85;
          
          groundedSegments.push({
            text: result.content.slice(0, 200) + "...", // Truncate content for display
            sources: [{
              url: result.url,
              title: result.title,
              confidence: confidence,
            }],
          });
        });
      }
    });

    return {
      queries,
      results: [],
      groundedSegments,
    };
  })();

  return (
    <div role="article" className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}>
      {message.parts.map((part, index) => {
        const { type } = part
        const key = `message-${message.id}-part-${index}`

        if (type === "reasoning") {
          return <MessageReasoning key={key} reasoning={part.reasoning} id={message.id} />
        }

        if (type === "text") {
          return message.role === "user" ? (
            <div
              key={key}
              className="relative group px-4 py-3 rounded-xl bg-secondary border border-secondary-foreground/2 max-w-[80%]"
            >
              {mode === "edit" && (
                <MessageEditor
                  threadId={threadId}
                  message={message}
                  content={part.text}
                  setMessages={setMessages}
                  reload={reload}
                  setMode={setMode}
                  stop={stop}
                  convexThreadId={convexThreadId}
                  convexMessageId={message.id as Id<"messages">}
                />
              )}
              {mode === "view" && <p>{part.text}</p>}

              {mode === "view" && (
                <MessageControls
                  threadId={threadId}
                  content={part.text}
                  message={message}
                  setMode={setMode}
                  setMessages={setMessages}
                  reload={reload}
                  stop={stop}
                  convexThreadId={convexThreadId}
                  convexMessageId={message.id as Id<"messages">}
                />
              )}
            </div>
          ) : (
            <div key={key} className="group flex flex-col gap-2 w-full">
              <MarkdownRenderer content={part.text} id={message.id} />
              {searchGroundingData && !isStreaming && (
                <SearchGrounding data={searchGroundingData} />
              )}
              {!isStreaming && (
                <MessageControls
                  threadId={threadId}
                  content={part.text}
                  message={message}
                  setMessages={setMessages}
                  reload={reload}
                  stop={stop}
                  convexThreadId={convexThreadId}
                  convexMessageId={message.id as Id<"messages">}
                />
              )}
            </div>
          )
        }
      })}
    </div>
  )
}

const PreviewMessage = memo(PureMessage, (prevProps, nextProps) => {
  if (prevProps.isStreaming !== nextProps.isStreaming) return false
  if (prevProps.message.id !== nextProps.message.id) return false
  if (!equal(prevProps.message.parts, nextProps.message.parts)) return false
  if (prevProps.convexThreadId !== nextProps.convexThreadId) return false
  return true
})

PreviewMessage.displayName = "PreviewMessage"

export default PreviewMessage
