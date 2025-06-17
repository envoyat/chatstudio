"use client"

import { useState } from "react"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface MessageReasoningProps {
  reasoning: string
  id: string
}

export default function MessageReasoning({ reasoning, id }: MessageReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!reasoning?.trim()) {
    return null
  }

  return (
    <div className="my-2 border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`reasoning-content-${id}`}
      >
        {isExpanded ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
        <span className="font-medium">Reasoning</span>
      </button>
      
      {isExpanded && (
        <div
          id={`reasoning-content-${id}`}
          className="px-3 py-2 bg-muted/20 border-t border-border/50"
        >
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {reasoning}
          </div>
        </div>
      )}
    </div>
  )
}
