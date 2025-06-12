import { encode } from "gpt-tokenizer"
import type { AIModel } from "@/lib/models"
import type { UIMessage } from "ai"

// Token limits for each model (placeholder values as requested)
export const MODEL_TOKEN_LIMITS: Record<AIModel, number> = {
  "Gemini 2.5 Pro": 1048576,
  "Gemini 2.5 Flash": 1048576,
  "Gemini 2.0 Flash": 128000,
  "Claude 4 Sonnet": 200000,
  "Claude Haiku 3.5": 200000,
  "Claude 4 Opus": 200000,
  "GPT-4.1": 128000,
  "GPT-4.1-mini": 128000,
  "GPT-4.1-nano": 128000,
  "o3": 128000,
  "o4-mini": 128000,
  "DeepSeek R1": 32000,
  "Gemini 2.0 Flash (OpenRouter)": 128000,
}

export const getModelTokenLimit = (model: AIModel): number => {
  return MODEL_TOKEN_LIMITS[model] || 128000 // Default to 128k if model not found
}

// Token counting utility using OpenAI tokenizer
// Note: This is a temporary solution using OpenAI's tokenizer for all models
// Eventually this should be replaced with model-specific tokenizers
export const countTokensInText = (text: string): number => {
  try {
    const tokens = encode(text)
    return tokens.length
  } catch (error) {
    console.warn("Failed to count tokens:", error)
    // Rough fallback estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }
}

export const countTokensInMessages = (messages: UIMessage[]): number => {
  let totalTokens = 0
  
  for (const message of messages) {
    // Count tokens in content
    if (message.content) {
      totalTokens += countTokensInText(message.content)
    }
    
    // Count tokens in role (system, user, assistant)
    totalTokens += countTokensInText(message.role || "")
    
    // Add some overhead tokens for message formatting
    totalTokens += 3 // Rough estimate for message structure overhead
  }
  
  return totalTokens
} 