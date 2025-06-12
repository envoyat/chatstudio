"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { useChatRunSettingsStore } from "@/frontend/stores/ChatRunSettingsStore"
import { useModelStore } from "@/frontend/stores/ModelStore"
import { getModelTokenLimit } from "@/lib/token-limits"

interface ChatRunSettingsProps {
  className?: string
}

export default function ChatRunSettings({ className }: ChatRunSettingsProps) {
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

  const formatTokenCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  const tokenUsagePercentage = (tokenCount / maxTokens) * 100
  const isNearLimit = tokenUsagePercentage > 80
  const isAtLimit = tokenUsagePercentage > 95

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Run Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Token Count Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Token Count:</span>
            <span className={`font-mono ${isAtLimit ? 'text-red-500' : isNearLimit ? 'text-orange-500' : 'text-foreground'}`}>
              {formatTokenCount(tokenCount)}/{formatTokenCount(maxTokens)}
            </span>
          </div>
          {/* Token Usage Bar */}
          <div className="w-full bg-secondary rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-orange-500' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(tokenUsagePercentage, 100)}%` }}
            />
          </div>
          {isNearLimit && (
            <p className={`text-xs ${isAtLimit ? 'text-red-500' : 'text-orange-500'}`}>
              {isAtLimit ? 'Token limit reached' : 'Approaching token limit'}
            </p>
          )}
        </div>

        <Separator />

        {/* Temperature Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">Temperature:</label>
            <span className="font-mono text-sm font-medium">
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
          <p className="text-xs text-muted-foreground">
            Lower values make output more focused and deterministic. Higher values increase randomness and creativity.
          </p>
        </div>
      </CardContent>
    </Card>
  )
} 