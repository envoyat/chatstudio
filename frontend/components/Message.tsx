"use client"

import { memo } from "react"
import MarkdownRenderer from "@/frontend/components/MemoizedMarkdown"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import equal from "fast-deep-equal"
import type { Id } from "@/convex/_generated/dataModel"

function PureMessage({
  message,
  convexThreadId,
}: {
  message: UIMessage
  convexThreadId: Id<"threads"> | null
}) {
  const isStreaming = message.role === "assistant" && (message.data as { isComplete?: boolean } | undefined)?.isComplete === false;

  return (
    <div role="article" className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}>
      <div
        className={cn(
          "group relative px-4 py-3 rounded-xl max-w-[80%]",
          message.role === "user" ? "bg-secondary border border-secondary-foreground/2" : ""
        )}
      >
        <MarkdownRenderer content={message.content} id={message.id} />
        {/* Note: Controls like edit/regenerate would need to be re-implemented 
            with the new mutation-based approach. They are removed for simplicity
            to match the core pattern of the article. */}
      </div>
    </div>
  )
}

const PreviewMessage = memo(PureMessage, (prevProps, nextProps) => {
  if (prevProps.message.id !== nextProps.message.id) return false
  if (!equal(prevProps.message, nextProps.message)) return false
  if (prevProps.convexThreadId !== nextProps.convexThreadId) return false
  return true
})

PreviewMessage.displayName = "PreviewMessage"

export default PreviewMessage
