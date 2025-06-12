import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ChatRunSettings = {
  temperature: number
  tokenCount: number
  maxTokens: number
}

type ChatRunSettingsStore = {
  temperature: number
  tokenCount: number
  maxTokens: number
  setTemperature: (temperature: number) => void
  setTokenCount: (count: number) => void
  setMaxTokens: (maxTokens: number) => void
  updateTokenCount: (count: number) => void
}

export const useChatRunSettingsStore = create<ChatRunSettingsStore>()(
  persist(
    (set) => ({
      temperature: 1.0,
      tokenCount: 0,
      maxTokens: 1048576, // Default to Gemini 2.5 Pro token limit
      
      setTemperature: (temperature) => set({ temperature }),
      setTokenCount: (tokenCount) => set({ tokenCount }),
      setMaxTokens: (maxTokens) => set({ maxTokens }),
      updateTokenCount: (tokenCount) => set({ tokenCount }),
    }),
    {
      name: "chat-run-settings",
      partialize: (state) => ({ 
        temperature: state.temperature 
      }),
    },
  ),
) 