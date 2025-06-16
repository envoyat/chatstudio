import { create } from 'zustand'

interface UILayoutState {
  isSettingsOpen: boolean
  setSettingsOpen: (isOpen: boolean) => void
  isSidebarOpen: boolean
  setSidebarOpen: (isOpen: boolean) => void
}

export const useUILayoutStore = create<UILayoutState>((set) => ({
  isSettingsOpen: false,
  setSettingsOpen: (isOpen) => {
    console.log('Setting settings open to:', isOpen)
    set({ isSettingsOpen: isOpen })
  },
  isSidebarOpen: true,
  setSidebarOpen: (isOpen) => {
    console.log('Setting sidebar open to:', isOpen)
    set({ isSidebarOpen: isOpen })
  },
})) 