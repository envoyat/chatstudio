"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Settings2, ChevronRight, X } from "lucide-react"
import { useChatRunSettingsStore } from "@/frontend/stores/ChatRunSettingsStore"
import { useModelStore } from "@/frontend/stores/ModelStore"
import { getModelTokenLimit } from "@/lib/token-limits"
import { useUILayoutStore } from "@/frontend/stores/UILayoutStore"

interface ChatRunSettingsProps {
  className?: string
}

export default function ChatRunSettings({ className }: ChatRunSettingsProps) {
  const { isSettingsOpen, setSettingsOpen, isSidebarOpen } = useUILayoutStore()
  
  const {
    temperature,
    tokenCount,
    maxTokens,
    setTemperature,
  } = useChatRunSettingsStore()
  
  const selectedModel = useModelStore((state) => state.selectedModel)
  
  // Update max tokens when model changes
  React.useEffect(() => {
    const newMaxTokens = getModelTokenLimit(selectedModel)
    useChatRunSettingsStore.getState().setMaxTokens(newMaxTokens)
  }, [selectedModel])

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
    console.log('Toggle clicked, current state:', isSettingsOpen)
    const newSettingsState = !isSettingsOpen
    console.log('Setting new state to:', newSettingsState)
    setSettingsOpen(newSettingsState)
  }

  // Debug effect to monitor state changes
  React.useEffect(() => {
    console.log('Settings panel state changed:', isSettingsOpen)
  }, [isSettingsOpen])

  return (
    <>
      {/* Toggle Button - Only show when sidebar is closed */}
      {!isSettingsOpen && !isSidebarOpen && (
        <Button
          onClick={togglePanel}
          variant="outline"
          size="sm"
          className="fixed right-4 top-4 z-[60] bg-background/95 backdrop-blur-sm border shadow-md hover:shadow-lg"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      )}

      {/* Side Panel */}
      <div
        className={`fixed right-0 top-0 z-[100] h-full transition-transform duration-300 ease-in-out ${
          isSettingsOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: '320px' }}
      >
        <div className="h-full bg-background/95 backdrop-blur-sm border-l shadow-xl">
          <div className="flex flex-col h-full p-4 space-y-4">
            {/* Header with Close Button and Theme Toggle */}
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

            <Separator />

            {/* Token Count Display */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Token Usage</h3>
              <div className="space-y-2">
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
                <div className="space-y-2">
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

            {/* Model Info */}
            <Separator />
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Current Model</h3>
              <p className="text-sm font-medium">{selectedModel}</p>
              <p className="text-xs text-muted-foreground">
                Context window: {formatTokenCount(maxTokens)} tokens
              </p>
            </div>
          </div>
        </div>

        {/* Overlay when panel is open (optional, for mobile) */}
        {isSettingsOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10 md:hidden"
            onClick={() => setSettingsOpen(false)}
          />
        )}
      </div>
    </>
  )
} 