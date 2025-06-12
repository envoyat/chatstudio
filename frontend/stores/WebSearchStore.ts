import { create } from "zustand"
import { persist } from "zustand/middleware"

interface WebSearchState {
  isWebSearchEnabled: boolean
  toggleWebSearch: () => void
  setWebSearchEnabled: (enabled: boolean) => void
}

export const useWebSearchStore = create<WebSearchState>()(
  persist(
    (set) => ({
      isWebSearchEnabled: false,
      toggleWebSearch: () =>
        set((state) => ({ isWebSearchEnabled: !state.isWebSearchEnabled })),
      setWebSearchEnabled: (enabled: boolean) =>
        set({ isWebSearchEnabled: enabled }),
    }),
    {
      name: "web-search-settings",
    }
  )
) 