import { create, type Mutate, type StoreApi } from "zustand"
import { persist } from "zustand/middleware"

export const PROVIDERS = ["google", "anthropic", "openai", "openrouter"] as const
export type Provider = (typeof PROVIDERS)[number]

type APIKeys = Record<Provider, string>

type APIKeyStore = {
  keys: APIKeys
  setKeys: (newKeys: Partial<APIKeys>) => void
  hasRequiredKeys: () => boolean
  getKey: (provider: Provider) => string | null
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

      hasRequiredKeys: () => {
        const keys = get().keys
        // If Google key is available (required), return true
        if (keys.google) return true
        // If no Google key but OpenRouter key is available, return true as fallback
        if (keys.openrouter) return true
        return false
      },

      getKey: (provider) => {
        const key = get().keys[provider]
        return key ? key : null
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
