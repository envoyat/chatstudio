// convex/models.ts - Simplified models config for Convex runtime

import { type Provider, PROVIDERS } from "./constants";

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
  supportsReasoning?: boolean,
  canToggleThinking?: boolean,
}

export const MODEL_CONFIGS: Record<AIModel, ModelConfig> = {
  "Gemini 2.5 Pro": {
    modelId: "gemini-2.5-pro-preview-05-06",
    provider: PROVIDERS.GOOGLE,
    supportsReasoning: true,
    canToggleThinking: false,
  },
  "Gemini 2.5 Flash": {
    modelId: "gemini-2.5-flash-preview-04-17",
    provider: PROVIDERS.GOOGLE,
    supportsReasoning: true,
    canToggleThinking: false,
  },
  "Gemini 2.5 Flash-Lite Preview": {
    modelId: "gemini-2.5-flash-lite-preview-06-17",
    provider: PROVIDERS.GOOGLE,
  },
  "Claude 4 Sonnet": {
    modelId: "claude-4-sonnet-20250514",
    provider: PROVIDERS.ANTHROPIC,
    supportsReasoning: true,
    canToggleThinking: true,
  },
  "Claude Haiku 3.5": {
    modelId: "claude-3-5-haiku-20241022",
    provider: PROVIDERS.ANTHROPIC,
  },
  "Claude 4 Opus": {
    modelId: "claude-4-opus-20250514",
    provider: PROVIDERS.ANTHROPIC,
    supportsReasoning: true,
    canToggleThinking: true,
  },
  "GPT-4.1": {
    modelId: "gpt-4.1",
    provider: PROVIDERS.OPENAI,
  },
  "GPT-4.1-mini": {
    modelId: "gpt-4.1-mini",
    provider: PROVIDERS.OPENAI,
  },
  "GPT-4.1-nano": {
    modelId: "gpt-4.1-nano",
    provider: PROVIDERS.OPENAI,
  },
  "o3": {
    modelId: "openai/o3",
    provider: PROVIDERS.OPENROUTER,
  },
  "o4-mini": {
    modelId: "o4-mini-2025-04-16",
    provider: PROVIDERS.OPENAI,
    supportsReasoning: true,
    canToggleThinking: false,
  },
  "DeepSeek R1": {
    modelId: "deepseek/deepseek-r1-0528:free",
    provider: PROVIDERS.OPENROUTER,
    supportsReasoning: true,
    canToggleThinking: true,
  }
} 