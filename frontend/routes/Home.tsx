"use client"

import Settings from "@/frontend/components/Settings"
import Chat from "@/frontend/components/Chat"
import { v4 as uuidv4 } from "uuid"
import { useAPIKeyStore } from "../stores/APIKeyStore"
import { useModelStore } from "../stores/ModelStore"
import { useEffect, useState, useMemo } from "react"
import { useConvexAuth } from "convex/react"
import { useSessionStore } from "../stores/sessionStore"

export default function Home() {
  const [isHydrated, setIsHydrated] = useState(false)
  const { isAuthenticated } = useConvexAuth()
  const { getOrCreateSessionId } = useSessionStore()

  // Generate a stable UUID for the new chat session.
  const conversationId = useMemo(() => uuidv4(), []);
  const hasRequiredKeys = useAPIKeyStore((state) => state.hasRequiredKeys())

  useEffect(() => {
    // Wait for stores to hydrate
    const checkHydration = () => {
      const apiKeysHydrated = useAPIKeyStore.persist?.hasHydrated?.() ?? true
      const modelStoreHydrated = useModelStore.persist?.hasHydrated?.() ?? true

      if (apiKeysHydrated && modelStoreHydrated) {
        setIsHydrated(true)
      }
    }

    checkHydration()

    // Fallback timeout
    const timeout = setTimeout(() => {
      setIsHydrated(true)
    }, 1000)

    // Ensure guest users have a session ID when they land on the home page.
    if (!isAuthenticated) {
      getOrCreateSessionId()
    }

    return () => clearTimeout(timeout)
  }, [isAuthenticated, getOrCreateSessionId])

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Chat Studio</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!hasRequiredKeys) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full max-w-3xl pt-10 pb-44 mx-auto">
        <Settings />
      </div>
    )
  }

  // The Chat component now handles all message loading internally using the persistent reactivity pattern
  return <Chat threadId={conversationId} />
}
