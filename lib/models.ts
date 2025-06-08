import type { Provider } from "@/frontend/stores/APIKeyStore"

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
] as const

export type AIModel = (typeof AI_MODELS)[number]

export type ModelConfig = {
  modelId: string
  provider: Provider
  headerKey: string
}

export const MODEL_CONFIGS = {
  "Gemini 2.5 Pro": {
    modelId: "gemini-2.5-pro-preview-05-06",
    provider: "google",
    headerKey: "X-Google-API-Key",
  },
  "Gemini 2.5 Flash": {
    modelId: "gemini-2.5-flash-preview-04-17",
    provider: "google",
    headerKey: "X-Google-API-Key",
  },
  "Gemini 2.0 Flash": {
    modelId: "gemini-2.0-flash",
    provider: "google",
    headerKey: "X-Google-API-Key",
  },
  "Claude 4 Sonnet": {
    modelId: "claude-4-sonnet-20250514",
    provider: "anthropic",
    headerKey: "X-Anthropic-API-Key",
  },
  "Claude Haiku 3.5": {
    modelId: "claude-3-5-haiku-20241022",
    provider: "anthropic",
    headerKey: "X-Anthropic-API-Key",
  },
  "Claude 4 Opus": {
    modelId: "claude-4-opus-20250514",
    provider: "anthropic",
    headerKey: "X-Anthropic-API-Key",
  },
  "GPT-4.1": {
    modelId: "gpt-4.1",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
  },
  "GPT-4.1-mini": {
    modelId: "gpt-4.1-mini",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
  },
  "GPT-4.1-nano": {
    modelId: "gpt-4.1-nano",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
  },
  "o3": {
    modelId: "o3",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
  },
  "o4-mini": {
    modelId: "o4-mini",
    provider: "openai",
    headerKey: "X-OpenAI-API-Key",
  },
} as const satisfies Record<AIModel, ModelConfig>

export const getModelConfig = (modelName: AIModel): ModelConfig => {
  return MODEL_CONFIGS[modelName]
}
