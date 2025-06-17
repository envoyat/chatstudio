"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface MessageReasoningProps {
  reasoning: string
  id: string
  isReasoningStreaming: boolean
}

export default function MessageReasoning({ reasoning, id, isReasoningStreaming }: MessageReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasBeenStreaming = useRef(false);

  if (!reasoning?.trim()) {
    return null
  }

  useEffect(() => {
    // If reasoning starts streaming, and we haven't already forced it open, expand it.
    if (isReasoningStreaming && !hasBeenStreaming.current) {
      setIsExpanded(true);
      hasBeenStreaming.current = true;
    }
  }, [isReasoningStreaming]);

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
        {isReasoningStreaming && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
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
