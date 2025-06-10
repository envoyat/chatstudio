import type { Provider } from "@/frontend/stores/APIKeyStore"
import { hasHostAPIKey, FREE_MODELS_WITH_HOST_KEY } from "@/lib/host-config"

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
  "o3",
  "o4-mini",
  "DeepSeek R1",
  "Gemini 2.0 Flash (OpenRouter)",
] as const

export type AIModel = (typeof AI_MODELS)[number]

export type ModelConfig = {
  modelId: string
  provider: Provider
  headerKey: string
  openRouterModelId?: string
  isUsingHostKey?: boolean
}

export const MODEL_CONFIGS = {
  "Gemini 2.5 Pro": {
    modelId: "gemini-2.5-pro-preview-05-06",
    provider: "google",
    headerKey: "X-Google-API-Key",
    openRouterModelId: "google/gemini-pro-1.5",
  },
  "Gemini 2.5 Flash": {
    modelId: "gemini-2.5-flash-preview-04-17",
    provider: "google",
    headerKey: "X-Google-API-Key",
    openRouterModelId: "google/gemini-flash-1.5",
  },
  "Gemini 2.0 Flash": {
    modelId: "gemini-2.0-flash",
    provider: "google",
    headerKey: "X-Google-API-Key",
    openRouterModelId: "google/gemini-2.0-flash-exp:free",
  },
  "Claude 4 Sonnet": {
    modelId: "claude-4-sonnet-20250514",
    provider: "anthropic",
    headerKey: "X-Anthropic-API-Key",
    openRouterModelId: "anthropic/claude-3.5-sonnet",
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
    openRouterModelId: "anthropic/claude-3-opus",
  },
  "GPT-4.1": {
    modelId: "gpt-4.1",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
    openRouterModelId: "openai/gpt-4o",
  },
  "GPT-4.1-mini": {
    modelId: "gpt-4.1-mini",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
    openRouterModelId: "openai/gpt-4o-mini",
  },
  "GPT-4.1-nano": {
    modelId: "gpt-4.1-nano",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
    openRouterModelId: "openai/gpt-4o-mini",
  },
  "o3": {
    modelId: "o3",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
    openRouterModelId: "openai/o1-preview",
  },
  "o4-mini": {
    modelId: "o4-mini",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
    openRouterModelId: "openai/o1-mini",
  },
  "DeepSeek R1": {
    modelId: "deepseek/deepseek-r1-0528:free",
    provider: "openrouter",
    headerKey: "X-OpenRouter-API-Key",
    openRouterModelId: "deepseek/deepseek-r1-0528:free",
  },
  "Gemini 2.0 Flash (OpenRouter)": {
    modelId: "google/gemini-2.0-flash-exp:free",
    provider: "openrouter",
    headerKey: "X-OpenRouter-API-Key",
    openRouterModelId: "google/gemini-2.0-flash-exp:free",
  },
} as const satisfies Record<AIModel, ModelConfig>

export const getModelConfig = (modelName: AIModel): ModelConfig => {
  return MODEL_CONFIGS[modelName]
}

// Get the effective model configuration based on available API keys
export const getEffectiveModelConfig = (
  modelName: AIModel,
  getApiKey: (provider: Provider) => string | null,
  hasUserKey?: (provider: Provider) => boolean
): ModelConfig => {
  const baseConfig = MODEL_CONFIGS[modelName]
  
  // Check if the user has their own API key for the original provider
  const userProviderKey = getApiKey(baseConfig.provider)
  if (userProviderKey) {
    return { ...baseConfig, isUsingHostKey: false }
  }
  
  // If it's a free model and user doesn't have their own key, check for host key
  if (FREE_MODELS_WITH_HOST_KEY.includes(modelName as any) && hasHostAPIKey(baseConfig.provider)) {
    return { ...baseConfig, isUsingHostKey: true }
  }
  
  // If no original provider key (user or host) and OpenRouter model exists, use OpenRouter
  const openRouterKey = getApiKey("openrouter")
  if (openRouterKey && baseConfig.openRouterModelId) {
    return {
      modelId: baseConfig.openRouterModelId,
      provider: "openrouter",
      headerKey: "X-OpenRouter-API-Key",
      openRouterModelId: baseConfig.openRouterModelId,
      isUsingHostKey: false,
    }
  }
  
  // Return original config as fallback (may not work without proper API key)
  return { ...baseConfig, isUsingHostKey: false }
}

// Check if a model is available based on API key availability
export const isModelAvailable = (
  modelName: AIModel,
  getApiKey: (provider: Provider) => string | null
): boolean => {
  const baseConfig = MODEL_CONFIGS[modelName]
  
  // Check if user has the original provider key
  if (getApiKey(baseConfig.provider)) return true
  
  // Check if it's a free model that can use host key
  if (FREE_MODELS_WITH_HOST_KEY.includes(modelName as any) && hasHostAPIKey(baseConfig.provider)) {
    return true
  }
  
  // Check if OpenRouter is available as fallback
  if (getApiKey("openrouter") && baseConfig.openRouterModelId) return true
  
  return false
}
