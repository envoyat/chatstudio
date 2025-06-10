import { create, type Mutate, type StoreApi } from "zustand"
import { persist } from "zustand/middleware"
import { type AIModel, getModelConfig, getEffectiveModelConfig, type ModelConfig } from "@/lib/models"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"

type ModelStore = {
  selectedModel: AIModel
  setModel: (model: AIModel) => void
  getModelConfig: () => ModelConfig
  getEffectiveModelConfig: () => ModelConfig
}

type StoreWithPersist = Mutate<StoreApi<ModelStore>, [["zustand/persist", { selectedModel: AIModel }]]>

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

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      selectedModel: "Gemini 2.0 Flash",

      setModel: (model) => {
        set({ selectedModel: model })
      },

      getModelConfig: () => {
        const { selectedModel } = get()
        return getModelConfig(selectedModel)
      },

      getEffectiveModelConfig: () => {
        const { selectedModel } = get()
        const getApiKey = useAPIKeyStore.getState().getKey
        return getEffectiveModelConfig(selectedModel, getApiKey)
      },
    }),
    {
      name: "selected-model",
      partialize: (state) => ({ selectedModel: state.selectedModel }),
    },
  ),
)

if (typeof window !== "undefined") {
  withStorageDOMEvents(useModelStore)
}
