"use client"

import { memo } from "react"
import MarkdownRenderer from "@/frontend/components/MemoizedMarkdown"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import equal from "fast-deep-equal"
import type { Id } from "@/convex/_generated/dataModel"

function PureMessage({
  message,
}: {
  message: UIMessage
}) {
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
  // Now that the parent component (Chat.tsx) memoizes the `messages` array,
  // we can rely on a simpler deep equal comparison.
  return equal(prevProps.message, nextProps.message);
})

PreviewMessage.displayName = "PreviewMessage"

export default PreviewMessage
