"use client"

import { useState } from "react"
import { ChevronDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SearchResult {
  title: string
  url: string
  content: string
  score?: number
}

interface SearchGroundingData {
  queries: string[]
  results: SearchResult[]
  groundedSegments: Array<{
    text: string
    sources: Array<{
      url: string
      title: string
      confidence: number
    }>
  }>
}

interface SearchGroundingProps {
  data: SearchGroundingData
}

export default function SearchGrounding({ data }: SearchGroundingProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!data || (!data.queries.length && !data.groundedSegments.length)) {
    return null
  }

  return (
    <div className="prose prose-pink mt-4 text-sm text-secondary-foreground dark:prose-invert">
      <Button
        variant="ghost"
        className="flex items-center gap-2 pt-2 p-0 h-auto text-sm hover:bg-transparent"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="grounding-content"
      >
        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
        <Search className="h-4 w-4" />
        Search Grounding Details
      </Button>

      {isExpanded && (
        <div id="grounding-content" className="mt-2 space-y-4">
          {/* Search Queries */}
          {data.queries.length > 0 && (
            <div className="space-y-2">
              <div className="font-medium text-foreground">Search Queries:</div>
              <div className="space-y-1 text-xs">
                {data.queries.map((query, index) => (
                  <div key={index} className="text-muted-foreground">
                    {query}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grounded Segments */}
          {data.groundedSegments.length > 0 && (
            <div className="space-y-2">
              <div className="font-medium text-foreground">Grounded Segments:</div>
              <div className="space-y-3">
                {data.groundedSegments.map((segment, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-2 rounded-md bg-sidebar/40 p-3 dark:bg-chat-accent"
                  >
                    <span className="text-sm">{segment.text}</span>
                    {segment.sources.length > 0 && (
                      <div className="space-y-2">
                        {segment.sources.map((source, sourceIndex) => {
                          const confidence = Math.round(source.confidence)
                          const confidenceColor = confidence >= 80 
                            ? "bg-green-400/60 text-green-900 dark:bg-green-800/30 dark:text-green-400"
                            : confidence >= 60
                            ? "bg-yellow-400/60 text-yellow-900 dark:bg-yellow-800/30 dark:text-yellow-400"
                            : "bg-red-400/60 text-red-900 dark:bg-red-800/30 dark:text-red-400"

                          return (
                            <div
                              key={sourceIndex}
                              className="flex items-baseline justify-between gap-2 text-xs"
                            >
                              <div className="flex-1">
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                >
                                  {source.title || new URL(source.url).hostname}
                                </a>
                              </div>
                              <div className={cn("shrink-0 rounded-full px-2 py-1", confidenceColor)}>
                                {confidence}% Confidence
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 