"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Settings2, X, Globe, Paperclip, Brain } from "lucide-react"
import { useChatRunSettingsStore } from "@/frontend/stores/ChatRunSettingsStore"
import { useModelStore } from "@/frontend/stores/ModelStore"
import { getModelTokenLimit } from "@/lib/token-limits"
import { getModelConfig } from "@/lib/models"
import { useUILayoutStore } from "@/frontend/stores/UILayoutStore"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { AttachmentItem } from "./AttachmentItem"
import type { Id } from "@/convex/_generated/dataModel"
import type { UIMessage } from "ai"

interface ChatRunSettingsProps {
  className?: string
  conversationId: Id<"conversations"> | null
  messages: UIMessage[]
}

export default function ChatRunSettings({ className, conversationId, messages }: ChatRunSettingsProps) {
  const { isSettingsOpen, setSettingsOpen } = useUILayoutStore()
  const settingsRef = React.useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  
  const {
    temperature,
    tokenCount,
    maxTokens,
    isWebSearchEnabled,
    isThinkingEnabled,
    setTemperature,
    toggleWebSearch,
    toggleThinking,
  } = useChatRunSettingsStore()
  
  const selectedModel = useModelStore((state) => state.selectedModel)
  
  // Conditionally fetch attachments. If it's a new chat (no messages),
  // we can skip the query entirely.
  const attachments = useQuery(
    api.attachments.getAttachmentsForConversation,
    messages.length > 0 && conversationId ? { conversationId } : "skip"
  )
  
  // Determine if the chat is new and has no messages yet
  const isNewChat = messages.length === 0
  const modelConfig = getModelConfig(selectedModel)
  
  // Update max tokens when model changes
  React.useEffect(() => {
    const newMaxTokens = getModelTokenLimit(selectedModel)
    useChatRunSettingsStore.getState().setMaxTokens(newMaxTokens)
  }, [selectedModel])

  // Handle click outside - only on mobile
  React.useEffect(() => {
    if (!isMobile) return
    
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is on the toggle button or its children
      const toggleButton = document.querySelector('[data-settings-toggle]')
      const isToggleButtonClick = toggleButton && (toggleButton === event.target || toggleButton.contains(event.target as Node))
      
      if (isSettingsOpen && settingsRef.current && !settingsRef.current.contains(event.target as Node) && !isToggleButtonClick) {
        setSettingsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSettingsOpen, setSettingsOpen, isMobile])

  const handleTemperatureChange = (value: number[]) => {
    setTemperature(value[0])
  }

  const MILLION_THRESHOLD = 1000000
  const THOUSAND_THRESHOLD = 1000

  const formatTokenCount = (count: number): string => {
    if (count >= MILLION_THRESHOLD) {
      return `${(count / MILLION_THRESHOLD).toFixed(1)}M`
    } else if (count >= THOUSAND_THRESHOLD) {
      return `${(count / THOUSAND_THRESHOLD).toFixed(1)}k`
    }
    return count.toString()
  }

  const tokenUsagePercentage = (tokenCount / maxTokens) * 100
  const isNearLimit = tokenUsagePercentage > 80
  const isAtLimit = tokenUsagePercentage > 95

  const togglePanel = () => {
    setSettingsOpen(!isSettingsOpen)
  }

  return (
    <>
      {/* Mobile backdrop blur */}
      {isMobile && isSettingsOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSettingsOpen(false)}
        />
      )}

      {/* Settings Panel Container - Desktop: shifts content, Mobile: overlays */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          isMobile 
            ? cn(
                "fixed right-0 top-0 z-50 h-full",
                isSettingsOpen ? "translate-x-0 w-80" : "translate-x-full w-80"
              )
            : cn(
                "relative h-full",
                isSettingsOpen ? "w-80" : "w-0"
              )
        )}
      >
        <div
          ref={settingsRef}
          className={cn(
            "h-full bg-background/95 backdrop-blur-sm flex flex-col",
            isMobile ? "border-l" : "border-l",
            !isSettingsOpen && !isMobile && "hidden"
          )}
        >
          {/* Fixed Header */}
          <div className="flex-none p-4 pb-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Run Settings</h2>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button
                  onClick={togglePanel}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 pt-4 space-y-6 no-scrollbar">
            {/* Token Count Display */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Token Usage</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current:</span>
                  <span className={`font-mono text-lg ${isAtLimit ? 'text-red-500' : isNearLimit ? 'text-orange-500' : 'text-foreground'}`}>
                    {formatTokenCount(tokenCount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Limit:</span>
                  <span className="font-mono text-muted-foreground">
                    {formatTokenCount(maxTokens)}
                  </span>
                </div>
                {/* Token Usage Bar */}
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-orange-500' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(tokenUsagePercentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>{tokenUsagePercentage.toFixed(1)}%</span>
                  <span>100%</span>
                </div>
                {isNearLimit && (
                  <p className={`text-xs ${isAtLimit ? 'text-red-500' : 'text-orange-500'}`}>
                    {isAtLimit ? '⚠️ Token limit reached' : '⚠️ Approaching token limit'}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Web Search Toggle */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Tools</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Web Search</span>
                </div>
                <Button
                  variant={isWebSearchEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={toggleWebSearch}
                  className="h-7"
                >
                  {isWebSearchEnabled ? "ON" : "OFF"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enable web search to get up-to-date information about recent events, current affairs, and real-time data.
              </p>
            </div>

            {/* Thinking Toggle */}
            {modelConfig.supportsReasoning && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Thinking</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Enable Reasoning</span>
                    </div>
                    <Switch
                      checked={modelConfig.canToggleThinking ? isThinkingEnabled : true}
                      onCheckedChange={modelConfig.canToggleThinking ? toggleThinking : undefined}
                      disabled={!modelConfig.canToggleThinking}
                      aria-label="Toggle model thinking"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {modelConfig.canToggleThinking
                      ? "Allow the model to show its reasoning steps before answering."
                      : "This model's reasoning feature is always on."}
                  </p>
                </div>
              </>
            )}

            <Separator />

            {/* Attachments Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments
              </h3>
              <div className="border rounded-lg bg-background max-h-64 overflow-y-auto">
                {/* New, more precise rendering logic */}
                {isNewChat ? (
                  // If it's a brand new chat, immediately show the empty state.
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No attachments in this conversation.
                  </div>
                ) : attachments === undefined ? (
                  // Only show loading if it's an existing chat and data is being fetched.
                  <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
                ) : attachments.length === 0 ? (
                  // Show empty state if the query returned no attachments.
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No attachments in this conversation.
                  </div>
                ) : (
                  // Render the list of attachments.
                  attachments.map((attachment) => (
                    <AttachmentItem key={attachment._id} attachment={attachment} />
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* Temperature Control */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Temperature</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Randomness:</span>
                  <span className="font-mono text-lg font-medium">
                    {temperature.toFixed(2)}
                  </span>
                </div>
                <div className="space-y-3">
                  <Slider
                    value={[temperature]}
                    onValueChange={handleTemperatureChange}
                    min={0}
                    max={2}
                    step={0.01}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0</span>
                    <span>1</span>
                    <span>2</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• <strong>Lower values (0-0.3):</strong> More focused and deterministic</p>
                  <p>• <strong>Medium values (0.4-1.0):</strong> Balanced creativity</p>
                  <p>• <strong>Higher values (1.1-2.0):</strong> More random and creative</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Model Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Current Model</h3>
              <div className="space-y-2">
                <p className="text-sm font-medium">{selectedModel}</p>
                <p className="text-xs text-muted-foreground">
                  Context window: {formatTokenCount(maxTokens)} tokens
                </p>
              </div>
            </div>

            {/* Bottom padding for scrolling */}
            <div className="h-4" />
          </div>
        </div>
      </div>

      {/* Toggle Button - Positioned based on panel state */}
      {!isSettingsOpen && (
        <Button
          onClick={togglePanel}
          variant="ghost"
          size="icon"
          data-settings-toggle
          className={cn(
            "fixed top-4 z-[60] h-8 w-8 rounded-full bg-background/50 backdrop-blur-sm",
            "transition-all duration-300 ease-in-out",
            isMobile ? "right-4" : "right-4"
          )}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      )}
    </>
  )
} 