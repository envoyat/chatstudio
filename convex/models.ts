// convex/models.ts - Simplified models config for Convex runtime

export const AI_MODELS = [
  "Gemini 2.5 Pro",
  "Gemini 2.5 Flash",
  "Gemini 2.0 Flash",
  "Claude 4 Sonnet",
  "Claude Haiku 3.5",
  "Claude 4 Opus",
  "GPT-4.1",
  "GPT-4.1-mini",
  "GPT-4.1-nano",
  // "o3", // Commented out: Requires organization verification for BYOK users
  "o4-mini",
  "DeepSeek R1",
  "Gemini 2.0 Flash (OpenRouter)",
] as const

export type AIModel = (typeof AI_MODELS)[number]

export type Provider = "google" | "anthropic" | "openai" | "openrouter"

export type ModelConfig = {
  modelId: string
  provider: Provider
  supportsReasoning?: boolean,
  canToggleThinking?: boolean,
}

export const MODEL_CONFIGS: Record<AIModel, ModelConfig> = {
  "Gemini 2.5 Pro": {
    modelId: "gemini-2.5-pro-preview-05-06",
    provider: "google",
    supportsReasoning: true,
    canToggleThinking: false,
  },
  "Gemini 2.5 Flash": {
    modelId: "gemini-2.5-flash-preview-04-17",
    provider: "google",
    supportsReasoning: true,
    canToggleThinking: false,
  },
  "Gemini 2.0 Flash": {
    modelId: "gemini-2.0-flash",
    provider: "google",
  },
  "Claude 4 Sonnet": {
    modelId: "claude-4-sonnet-20250514",
    provider: "anthropic",
    supportsReasoning: true,
    canToggleThinking: true,
  },
  "Claude Haiku 3.5": {
    modelId: "claude-3-5-haiku-20241022",
    provider: "anthropic",
  },
  "Claude 4 Opus": {
    modelId: "claude-4-opus-20250514",
    provider: "anthropic",
    supportsReasoning: true,
    canToggleThinking: true,
  },
  "GPT-4.1": {
    modelId: "gpt-4.1",
    provider: "openai",
  },
  "GPT-4.1-mini": {
    modelId: "gpt-4.1-mini",
    provider: "openai",
  },
  "GPT-4.1-nano": {
    modelId: "gpt-4.1-nano",
    provider: "openai",
  },
  // "o3": {
  //   modelId: "o3-2025-04-16",
  //   provider: "openai",
  // },
  "o4-mini": {
    modelId: "o4-mini-2025-04-16",
    provider: "openai",
    supportsReasoning: true,
    canToggleThinking: false,
  },
  "DeepSeek R1": {
    modelId: "deepseek/deepseek-r1-0528:free",
    provider: "openrouter",
    supportsReasoning: true,
    canToggleThinking: true,
  },
  "Gemini 2.0 Flash (OpenRouter)": {
    modelId: "google/gemini-2.0-flash-exp:free",
    provider: "openrouter",
  },
} 