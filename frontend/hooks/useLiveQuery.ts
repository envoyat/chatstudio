"use client"

import { useState, useEffect, useCallback } from "react"

export function useLiveQuery<T>(queryFn: () => Promise<T> | T, deps: any[] = []): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined)

  const executeQuery = useCallback(async () => {
    try {
      const result = await queryFn()
      setData(result)
    } catch (error) {
      console.error("Query error:", error)
    }
  }, deps)

  useEffect(() => {
    executeQuery()

    // Listen for storage changes to update data when other tabs modify it
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith("chatstudio_")) {
        executeQuery()
      }
    }

    window.addEventListener("storage", handleStorageChange)

    // Also listen for custom events for same-tab updates
    const handleCustomUpdate = () => {
      executeQuery()
    }

    window.addEventListener("chatstudio-update", handleCustomUpdate)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("chatstudio-update", handleCustomUpdate)
    }
  }, [executeQuery])

  return data
}

// Helper function to trigger updates across the app
export function triggerUpdate() {
  window.dispatchEvent(new CustomEvent("chatstudio-update"))
}
