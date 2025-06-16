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

  const isStreaming = message.role === 'assistant' && (message.data as any)?.isComplete === false;

  // Pre-process parts to group consecutive tool calls
  const renderedBlocks = [];
  let currentToolCalls: any[] = [];

  for (const part of message.parts ?? []) {
    const partData = part as any; // Type assertion for our custom parts
    if (partData.type === 'tool-call') {
      currentToolCalls.push(partData);
    } else {
      // We hit a non-tool part, so render any collected tools first
      if (currentToolCalls.length > 0) {
        const toolOutputs = (message.parts || []).filter((p: any) => p.type === 'tool-result' && currentToolCalls.some(c => c.id === p.toolCallId)) as any[];
        renderedBlocks.push(
          <ToolCallDisplay 
            key={`tool-block-${renderedBlocks.length}`}
            toolCalls={currentToolCalls}
            toolOutputs={toolOutputs} 
          />
        );
        currentToolCalls = [];
      }
      
      // Then render the current part (only text for now)
      if (partData.type === 'text' && partData.text) {
        renderedBlocks.push(
          <MarkdownRenderer key={`text-block-${renderedBlocks.length}`} content={partData.text} id={`${message.id}-${renderedBlocks.length}`} />
        );
      }
    }
  }

  // Render any remaining tools at the end
  if (currentToolCalls.length > 0) {
    const toolOutputs = (message.parts || []).filter((p: any) => p.type === 'tool-result' && currentToolCalls.some(c => c.id === p.toolCallId)) as any[];
    renderedBlocks.push(
      <ToolCallDisplay key={`tool-block-final`} toolCalls={currentToolCalls} toolOutputs={toolOutputs} />
    );
  }

  const handleSetMode = (newMode: "view" | "edit") => {
    if (isStreaming && newMode === "edit") return;
    setMode(newMode);
  }

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
        
        {mode === "view" && !isStreaming && (
          // Only show controls if there's some text content to control
          (message.parts || []).some((p: any) => p.type === 'text' && p.text?.trim() !== '')
        ) && (
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
