"use client"

import { useEffect } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import ChatSidebar from "@/frontend/components/ChatSidebar"
import { Outlet } from "react-router-dom"
import { useSessionStore } from "./stores/sessionStore"
import { useConvexAuth } from "convex/react"
import { useClearGuestData } from "@/lib/convex-hooks"

export default function ChatLayout() {
  const { isAuthenticated } = useConvexAuth();
  const { sessionId, clearSessionId } = useSessionStore();
  const clearGuestData = useClearGuestData();

  useEffect(() => {
    // When a user logs in, clear any existing guest session data from the database.
    if (isAuthenticated && sessionId) {
      clearGuestData({ sessionId });
      clearSessionId();
    }
  }, [isAuthenticated, sessionId, clearGuestData, clearSessionId]);

  return (
    <SidebarProvider>
      <ChatSidebar />
      <div className="flex-1 relative">
        <Outlet />
      </div>
    </SidebarProvider>
  )
}
