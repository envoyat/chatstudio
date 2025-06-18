import type { Provider } from "@/frontend/stores/APIKeyStore"
import { hasHostAPIKey, FREE_MODELS_WITH_HOST_KEY } from "@/lib/host-config"

export const AI_MODELS = [
  "Gemini 2.5 Pro",
  "Gemini 2.5 Flash",
  "Gemini 2.5 Flash-Lite Preview",
  "Claude 4 Sonnet",
  "Claude Haiku 3.5",
  "Claude 4 Opus",
  "GPT-4.1",
  "GPT-4.1-mini",
  "GPT-4.1-nano",
  "o3",
  "o4-mini",
  "DeepSeek R1",
] as const

export type AIModel = (typeof AI_MODELS)[number]

export type ModelConfig = {
  modelId: string
  provider: Provider
  headerKey: string
  openRouterModelId?: string
  isUsingHostKey?: boolean
  supportsReasoning?: boolean
  canToggleThinking?: boolean
}

export const MODEL_CONFIGS: Record<AIModel, ModelConfig> = {
  "Gemini 2.5 Pro": {
    modelId: "gemini-2.5-pro-preview-05-06",
    provider: "google",
    headerKey: "X-Google-API-Key",
    openRouterModelId: "google/gemini-2.5-pro",
    supportsReasoning: true,
    canToggleThinking: false,
  },
  "Gemini 2.5 Flash": {
    modelId: "gemini-2.5-flash-preview-04-17",
    provider: "google",
    headerKey: "X-Google-API-Key",
    openRouterModelId: "google/gemini-2.5-flash",
    supportsReasoning: true,
    canToggleThinking: false,
  },
  "Gemini 2.5 Flash-Lite Preview": {
    modelId: "gemini-2.5-flash-lite-preview-06-17",
    provider: "google",
    headerKey: "X-Google-API-Key",
    openRouterModelId: "google/gemini-2.5-flash-lite-preview-06-17",
  },
  "Claude 4 Sonnet": {
    modelId: "claude-4-sonnet-20250514",
    provider: "anthropic",
    headerKey: "X-Anthropic-API-Key",
    openRouterModelId: "anthropic/claude-sonnet-4",
    supportsReasoning: true,
    canToggleThinking: true,
  },
  "Claude Haiku 3.5": {
    modelId: "claude-3-5-haiku-20241022",
    provider: "anthropic",
    headerKey: "X-Anthropic-API-Key",
    openRouterModelId: "anthropic/claude-3.5-haiku",
  },
  "Claude 4 Opus": {
    modelId: "claude-4-opus-20250514",
    provider: "anthropic",
    headerKey: "X-Anthropic-API-Key",
    openRouterModelId: "anthropic/claude-opus-4",
    supportsReasoning: true,
    canToggleThinking: true,
  },
  "GPT-4.1": {
    modelId: "gpt-4.1",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
    openRouterModelId: "openai/gpt-4.1",
  },
  "GPT-4.1-mini": {
    modelId: "gpt-4.1-mini",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
    openRouterModelId: "openai/gpt-4.1-mini",
  },
  "GPT-4.1-nano": {
    modelId: "gpt-4.1-nano",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
    openRouterModelId: "openai/gpt-4.1-nano",
  },
  "o3": {
    modelId: "openai/o3",
    provider: "openrouter",
    headerKey: "X-OpenAI-API-Key",
    openRouterModelId: "openai/o3",
  },
  "o4-mini": {
    modelId: "o4-mini-2025-04-16",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
    openRouterModelId: "openai/o4-mini",
    supportsReasoning: true,
    canToggleThinking: false,
  },
  "DeepSeek R1": {
    modelId: "deepseek/deepseek-r1",
    provider: "openrouter",
    headerKey: "X-OpenRouter-API-Key",
    openRouterModelId: "deepseek/deepseek-r1",
    supportsReasoning: true,
    canToggleThinking: true,
  },
} as const satisfies Record<AIModel, ModelConfig>

export const getModelConfig = (modelName: AIModel): ModelConfig => {
  return MODEL_CONFIGS[modelName]
}

/**
 * Determines the effective configuration for a model based on available API keys.
 * This function implements the priority:
 * 1. User's native provider key.
 * 2. User's OpenRouter key (if model is available on OpenRouter).
 * 3. Host's Google key (for free-tier Google models only).
 */
export const getEffectiveModelConfig = (
  modelName: AIModel,
  getApiKey: (provider: Provider) => string | null
): ModelConfig => {
  const baseConfig = getModelConfig(modelName)

  // Priority 1: User's native provider key
  if (getApiKey(baseConfig.provider)) {
    return { ...baseConfig, isUsingHostKey: false }
  }

  // Priority 2: User's OpenRouter key as a fallback
  if (getApiKey("openrouter") && baseConfig.openRouterModelId) {
    return {
      ...baseConfig, // keep original reasoning/thinking flags
      modelId: baseConfig.openRouterModelId,
      provider: "openrouter",
      headerKey: "X-OpenRouter-API-Key",
      openRouterModelId: baseConfig.openRouterModelId,
      isUsingHostKey: false,
    }
  }

  // Priority 3: Host's Google key for free-tier models
  if (
    baseConfig.provider === "google" &&
    hasHostAPIKey("google") &&
    FREE_MODELS_WITH_HOST_KEY.includes(modelName as any)
  ) {
    return { ...baseConfig, isUsingHostKey: true }
  }

  // Fallback: No key available, return base config.
  // The UI/backend will handle the missing key error.
  return { ...baseConfig, isUsingHostKey: false }
}

/**
 * Checks if a model is usable based on available API keys.
 */
export const isModelAvailable = (
  modelName: AIModel,
  getApiKey: (provider: Provider) => string | null
): boolean => {
  const effectiveConfig = getEffectiveModelConfig(modelName, getApiKey)

  // If the effective config is using the host key, it's available.
  if (effectiveConfig.isUsingHostKey) {
    return true
  }

  // Otherwise, a user key for the effective provider must exist.
  return !!getApiKey(effectiveConfig.provider)
}
