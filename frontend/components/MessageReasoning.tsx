"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { Loader2 } from "lucide-react"
import MarkdownRenderer from "@/frontend/components/MemoizedMarkdown"

interface MessageReasoningProps {
  reasoning: string
  id: string
  isReasoningStreaming: boolean
}

export default function MessageReasoning({ reasoning, id, isReasoningStreaming }: MessageReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!reasoning?.trim()) {
    return null
  }

  return (
    <div className="my-2 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors text-foreground"
        aria-expanded={isExpanded}
        aria-controls={`reasoning-content-${id}`}
      >
        {isExpanded ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
        <span className="font-medium">Reasoning</span>
        {isReasoningStreaming && <Loader2 className="h-4 w-4 animate-spin" />}
      </button>
      
      {isExpanded && (
        <div
          id={`reasoning-content-${id}`}
          className="px-3 py-3 bg-muted/60 dark:bg-muted/80"
        >
          <div className="text-foreground dark:text-foreground">
            <MarkdownRenderer content={reasoning} id={`${id}-reasoning-content`} size="small" />
          </div>
        </div>
      )}
    </div>
  )
}
