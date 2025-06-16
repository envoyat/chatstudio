"use client"

import { memo, useState } from "react"
import MarkdownRenderer from "@/frontend/components/MemoizedMarkdown"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import equal from "fast-deep-equal"
import type { Id } from "@/convex/_generated/dataModel"
import MessageControls from "./MessageControls"
import MessageEditor from "./MessageEditor"
import ToolCallDisplay from "./ToolCallDisplay"
import { MESSAGE_ROLES } from "@/convex/constants"
import type { ToolCall, ToolOutput, UIMessageData } from "@/convex/types"

function PureMessage({
  message,
  messages,
  convexConversationId,
}: {
  message: UIMessage
  messages: UIMessage[]
  convexConversationId: Id<"conversations"> | null
}) { 
  const [mode, setMode] = useState<"view" | "edit">("view");

  const messageData = message.data as UIMessageData | undefined;
  const isStreaming = message.role === 'assistant' && messageData?.isComplete === false;

  // Pre-process parts to group consecutive tool calls
  const renderedBlocks = [];
  let currentToolCalls: ToolCall[] = [];

  const messageParts = message.parts ?? [];

  for (const part of messageParts) {
    // Handle tool-invocation parts
    if (part.type === 'tool-invocation' && 'toolInvocation' in part) {
      const toolInvocation = part.toolInvocation;
      
      // Convert to our ToolCall format when it's in 'call' state
      if (toolInvocation.state === 'call' || toolInvocation.state === 'partial-call') {
        currentToolCalls.push({
          id: toolInvocation.toolCallId,
          name: toolInvocation.toolName,
          args: toolInvocation.args,
        });
      }
    } else {
      // We hit a non-tool part, so render any collected tools first
      if (currentToolCalls.length > 0) {
        // Get tool outputs for current tool calls
        const toolOutputs: ToolOutput[] = [];
        
        // Look for tool-invocation parts with 'result' state
        for (const p of messageParts) {
          if (p.type === 'tool-invocation' && 'toolInvocation' in p) {
            const inv = p.toolInvocation;
            if (inv.state === 'result' && currentToolCalls.some(call => call.id === inv.toolCallId)) {
              toolOutputs.push({
                toolCallId: inv.toolCallId,
                result: inv.result,
              });
            }
          }
        }

        renderedBlocks.push(
          <ToolCallDisplay 
            key={`tool-block-${renderedBlocks.length}`}
            toolCalls={currentToolCalls}
            toolOutputs={toolOutputs} 
          />
        );
        currentToolCalls = [];
      }
      
      // Render other part types
      if (part.type === 'text' && 'text' in part) {
        renderedBlocks.push(
          <MarkdownRenderer key={`text-block-${renderedBlocks.length}`} content={part.text} id={`${message.id}-${renderedBlocks.length}`} />
        );
      } else if (part.type === 'file' && 'url' in part) {
        const filePart = part as any; // Type assertion for file part
        renderedBlocks.push(
          <div key={`file-block-${renderedBlocks.length}`} className="my-2">
            <a href={filePart.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              📎 {filePart.filename || 'File'} ({filePart.mediaType || 'unknown'})
            </a>
          </div>
        );
      } else if (part.type === 'source' && 'source' in part) {
        const sourcePart = part as any; // Type assertion for source part
        renderedBlocks.push(
          <div key={`source-block-${renderedBlocks.length}`} className="text-sm text-muted-foreground my-1">
            📚 Source: <a href={sourcePart.source.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              {sourcePart.source.title || sourcePart.source.url}
            </a>
          </div>
        );
      } else if (part.type === 'reasoning' && 'reasoning' in part) {
        const reasoningPart = part as any; // Type assertion for reasoning part
        renderedBlocks.push(
          <details key={`reasoning-block-${renderedBlocks.length}`} className="my-2">
            <summary className="cursor-pointer text-sm text-muted-foreground">💭 Show reasoning</summary>
            <div className="mt-1 pl-4 text-sm opacity-80">{reasoningPart.reasoning}</div>
          </details>
        );
      } else if (part.type === 'step-start') {
        renderedBlocks.push(
          <hr key={`step-${renderedBlocks.length}`} className="my-2 border-border/50" />
        );
      }
    }
  }

  // Render any remaining tools at the end
  if (currentToolCalls.length > 0) {
    const toolOutputs: ToolOutput[] = [];
    
    // Look for tool-invocation parts with 'result' state
    for (const p of messageParts) {
      if (p.type === 'tool-invocation' && 'toolInvocation' in p) {
        const inv = p.toolInvocation;
        if (inv.state === 'result' && currentToolCalls.some(call => call.id === inv.toolCallId)) {
          toolOutputs.push({
            toolCallId: inv.toolCallId,
            result: inv.result,
          });
        }
      }
    }

    renderedBlocks.push(
      <ToolCallDisplay key={`tool-block-final`} toolCalls={currentToolCalls} toolOutputs={toolOutputs} />
    );
  }

  const handleSetMode = (newMode: "view" | "edit") => {
    if (isStreaming && newMode === "edit") return;
    setMode(newMode);
  }

  const hasTextContent = messageParts.some(part => part.type === 'text' && 'text' in part);

  return (
    <div role="article" className={cn("flex flex-col", message.role === MESSAGE_ROLES.USER ? "items-end" : "items-start")}>
      <div
        className={cn(
          "group relative px-4 py-3 rounded-xl",
          message.role === MESSAGE_ROLES.USER 
            ? "bg-secondary border border-secondary-foreground/2 max-w-[80%]" 
            : "w-full"
        )}
      >
        {mode === "edit" ? (
          <MessageEditor
            message={message}
            setMode={setMode}
            convexConversationId={convexConversationId}
          />
        ) : (
          // Render the processed blocks
          renderedBlocks.map((block, i) => <div key={i}>{block}</div>)
        )}
        
        {mode === "view" && !isStreaming && hasTextContent && (
          <MessageControls
            message={message}
            messages={messages}
            setMode={handleSetMode}
            convexConversationId={convexConversationId}
          />
        )}
      </div>
    </div>
  )
}

const PreviewMessage = memo(PureMessage, (prevProps, nextProps) => {
  if (prevProps.convexConversationId !== nextProps.convexConversationId) return false
  if (!equal(prevProps.message, nextProps.message)) return false
  if (!equal(prevProps.messages, nextProps.messages)) return false
  return true
})

PreviewMessage.displayName = "PreviewMessage"

export default PreviewMessage
