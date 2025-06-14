"use client"

import { memo, useState } from "react"
import MarkdownRenderer from "@/frontend/components/MemoizedMarkdown"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import equal from "fast-deep-equal"
import type { Id } from "@/convex/_generated/dataModel"
import MessageControls from "./MessageControls"
import MessageEditor from "./MessageEditor"
import { MESSAGE_ROLES } from "@/convex/constants"

function PureMessage({
  message,
  messages,
  convexThreadId,
}: {
  message: UIMessage
  messages: UIMessage[]
  convexThreadId: Id<"threads"> | null
}) {
  const [mode, setMode] = useState<"view" | "edit">("view")

  const isStreaming = message.role === MESSAGE_ROLES.ASSISTANT && (message.data as { isComplete?: boolean })?.isComplete === false;

  const handleSetMode = (newMode: "view" | "edit") => {
    // Prevent editing a message if another one is currently streaming.
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
            convexThreadId={convexThreadId}
          />
        ) : (
          <MarkdownRenderer content={message.content} id={message.id} />
        )}
        
        {/* Render controls only when not editing and not streaming */}
        {mode === "view" && !isStreaming && (
          <MessageControls
            message={message}
            messages={messages}
            setMode={handleSetMode}
            convexThreadId={convexThreadId}
          />
        )}
      </div>
    </div>
  )
}

const PreviewMessage = memo(PureMessage, (prevProps, nextProps) => {
  if (prevProps.convexThreadId !== nextProps.convexThreadId) return false
  if (!equal(prevProps.message, nextProps.message)) return false
  if (!equal(prevProps.messages, nextProps.messages)) return false
  return true
})

PreviewMessage.displayName = "PreviewMessage"

export default PreviewMessage
