export const MESSAGE_ROLES = {
  USER: "user",
  ASSISTANT: "assistant", 
  SYSTEM: "system",
  DATA: "data"
} as const;

export type MessageRole = typeof MESSAGE_ROLES[keyof typeof MESSAGE_ROLES]; 

export const PROVIDERS = {
  OPENAI: "openai",
  GOOGLE: "google", 
  ANTHROPIC: "anthropic",
  OPENROUTER: "openrouter"
} as const;

export type Provider = typeof PROVIDERS[keyof typeof PROVIDERS]; 