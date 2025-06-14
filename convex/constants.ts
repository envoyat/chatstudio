export const MESSAGE_ROLES = {
  USER: "user",
  ASSISTANT: "assistant", 
  SYSTEM: "system",
  DATA: "data"
} as const;

export type MessageRole = typeof MESSAGE_ROLES[keyof typeof MESSAGE_ROLES]; 