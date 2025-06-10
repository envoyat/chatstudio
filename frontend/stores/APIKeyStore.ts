import { create, type Mutate, type StoreApi } from "zustand"
import { persist } from "zustand/middleware"
import { hasHostAPIKey } from "@/lib/host-config"

export const PROVIDERS = ["google", "anthropic", "openai", "openrouter"] as const
export type Provider = (typeof PROVIDERS)[number]

type APIKeys = Record<Provider, string>

type APIKeyStore = {
  keys: APIKeys
  setKeys: (newKeys: Partial<APIKeys>) => void
  clearKey: (provider: Provider) => void
  hasRequiredKeys: () => boolean
  getKey: (provider: Provider) => string | null
  hasUserKey: (provider: Provider) => boolean
  canUseProvider: (provider: Provider) => boolean
}

type StoreWithPersist = Mutate<StoreApi<APIKeyStore>, [["zustand/persist", { keys: APIKeys }]]>

export const withStorageDOMEvents = (store: StoreWithPersist) => {
  const storageEventCallback = (e: StorageEvent) => {
    if (e.key === store.persist.getOptions().name && e.newValue) {
      store.persist.rehydrate()
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", storageEventCallback)
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", storageEventCallback)
    }
  }
}

export const useAPIKeyStore = create<APIKeyStore>()(
  persist(
    (set, get) => ({
      keys: {
        google: "",
        anthropic: "",
        openai: "",
        openrouter: "",
      },

      setKeys: (newKeys) => {
        set((state) => ({
          keys: { ...state.keys, ...newKeys },
        }))
      },

      clearKey: (provider) => {
        set((state) => ({
          keys: { ...state.keys, [provider]: "" },
        }))
      },

      hasRequiredKeys: () => {
        const state = get()
        // If user has Google key, return true
        if (state.keys.google) return true
        // If no user Google key but host Google key is available, return true
        if (hasHostAPIKey("google")) return true
        // If no Google options but OpenRouter key is available, return true as fallback
        if (state.keys.openrouter) return true
        return false
      },

      getKey: (provider) => {
        const key = get().keys[provider]
        return key ? key : null
      },

      hasUserKey: (provider) => {
        const key = get().keys[provider]
        return !!key
      },

      canUseProvider: (provider) => {
        const state = get()
        // Check if user has their own key
        if (state.keys[provider]) return true
        // Check if host has a key for this provider
        return hasHostAPIKey(provider)
      },
    }),
    {
      name: "api-keys",
      partialize: (state) => ({ keys: state.keys }),
    },
  ),
)

if (typeof window !== "undefined") {
  withStorageDOMEvents(useAPIKeyStore)
}
