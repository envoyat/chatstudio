"use client"

import { useEffect, useState } from "react"

interface WelcomeScreenProps {
  // No props needed for the simplified welcome screen
}

export default function WelcomeScreen({}: WelcomeScreenProps) {
  const [chatInputHeight, setChatInputHeight] = useState(0)

  useEffect(() => {
    // Find the chat input wrapper element and observe its height
    const chatInputWrapper = document.querySelector('[ref="chatInputWrapperRef"]') as HTMLElement
    if (!chatInputWrapper) {
      // Fallback: try to find it by the sticky bottom class structure
      const stickyElement = document.querySelector('.sticky.bottom-0.pb-4') as HTMLElement
      if (stickyElement) {
        setChatInputHeight(stickyElement.offsetHeight)
        
        const observer = new ResizeObserver(() => {
          setChatInputHeight(stickyElement.offsetHeight)
        })
        observer.observe(stickyElement)
        
        return () => observer.disconnect()
      }
      return
    }

    setChatInputHeight(chatInputWrapper.offsetHeight)
    
    const observer = new ResizeObserver(() => {
      setChatInputHeight(chatInputWrapper.offsetHeight)
    })
    observer.observe(chatInputWrapper)
    
    return () => observer.disconnect()
  }, [])

  return (
    <div 
      className="flex flex-col items-center justify-center px-4"
      style={{
        minHeight: `calc(100vh - 2.5rem - ${chatInputHeight}px)`, // 100vh - top padding (2.5rem = 40px) - chat input height
      }}
    >
      <div className="max-w-2xl w-full text-center space-y-6">
        {/* Welcome heading */}
        <h1 className="text-4xl font-semibold text-foreground">
          Welcome to ChatStudio
        </h1>
        
        <p className="text-xl text-muted-foreground">
          How can I help?
        </p>
      </div>
    </div>
  )
} 