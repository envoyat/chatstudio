"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface ScrollIndicatorProps {
  containerRef: React.RefObject<HTMLElement | null>
  className?: string
}

export default function ScrollIndicator({ containerRef, className }: ScrollIndicatorProps) {
  const [scrollInfo, setScrollInfo] = useState({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    canScroll: false,
  })
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateScrollInfo = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const canScroll = scrollHeight > clientHeight
      
      setScrollInfo({
        scrollTop,
        scrollHeight,
        clientHeight,
        canScroll,
      })

      // Show indicator when scrolling
      if (canScroll) {
        setIsVisible(true)
        
        // Hide after 1 second of no scrolling
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          setIsVisible(false)
        }, 1000)
      }
    }

    // Initial check
    updateScrollInfo()

    // Listen for scroll events
    container.addEventListener("scroll", updateScrollInfo)
    
    // Listen for resize events (in case content changes)
    const resizeObserver = new ResizeObserver(updateScrollInfo)
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener("scroll", updateScrollInfo)
      resizeObserver.disconnect()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [containerRef])

  // Don't render if scrolling isn't possible
  if (!scrollInfo.canScroll) return null

  // Calculate indicator position and size
  const scrollableHeight = scrollInfo.scrollHeight - scrollInfo.clientHeight
  const scrollPercentage = scrollInfo.scrollTop / scrollableHeight
  
  // Indicator height should be proportional to visible content
  const indicatorHeight = Math.max(
    20, // Minimum height
    (scrollInfo.clientHeight / scrollInfo.scrollHeight) * scrollInfo.clientHeight * 0.8
  )
  
  // Available space for indicator movement
  const availableSpace = scrollInfo.clientHeight - indicatorHeight - 16 // 16px for padding
  const indicatorTop = 8 + (scrollPercentage * availableSpace) // 8px top padding

  return (
    <div
      className={cn(
        "fixed right-1 pointer-events-none transition-opacity duration-200 z-10",
        isVisible ? "opacity-60" : "opacity-0",
        className
      )}
      style={{
        top: containerRef.current?.getBoundingClientRect().top || 0,
        height: scrollInfo.clientHeight,
      }}
    >
      <div
        className="w-1 bg-foreground rounded-full transition-all duration-100 ease-out"
        style={{
          height: indicatorHeight,
          transform: `translateY(${indicatorTop}px)`,
        }}
      />
    </div>
  )
} 