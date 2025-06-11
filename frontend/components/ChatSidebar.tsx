"use client"

import * as React from "react"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { X, Plus, Settings, ChevronLeft, ChevronRight, MessageSquare, LogIn } from "lucide-react"
import { cn } from "@/lib/utils"
import { memo } from "react"
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react"
import { SignInButton, UserButton, useUser } from "@clerk/nextjs"
import { useThreads, useDeleteThread } from "@/lib/convex-hooks"
import { convertConvexThread } from "@/lib/convex-storage"
import type { Id } from "@/convex/_generated/dataModel"
import { ROUTES } from "@/frontend/constants/routes"

export default function ChatSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, toggle } = useSidebar()
  const { isAuthenticated } = useConvexAuth()

  // For authenticated users, use Convex
  const convexThreads = useThreads()
  const deleteThreadMutation = useDeleteThread()

  // Convert Convex threads to app format
  const threads = React.useMemo(() => {
    if (!isAuthenticated || !convexThreads) return []
    return convexThreads.map(convertConvexThread)
  }, [convexThreads, isAuthenticated])

  // Extract thread ID from various possible paths
  const currentThreadId = location.pathname.includes("/chat/") ? location.pathname.split("/chat/")[1] : null
  const isCollapsed = state === "collapsed"

  const handleDeleteThread = async (convexThreadId: Id<"threads">, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    if (isAuthenticated) {
      // Use Convex mutation for authenticated users
      try {
        // Pass the actual Convex ID
        await deleteThreadMutation({ threadId: convexThreadId })
        navigate(ROUTES.CHAT)
      } catch (error) {
        console.error('Failed to delete thread:', error)
      }
    }
  }

  return (
    <>
      <Sidebar
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isCollapsed ? "w-0" : "w-64",
        )}
      >
        <Header />
        <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden">
          <Authenticated>
            <SidebarGroup className="px-0">
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {threads?.map((thread) => {
                    return (
                      <SidebarMenuItem key={thread.id}>
                        <div
                          className={cn(
                            "cursor-pointer group/thread h-10 flex items-center px-2 py-2 rounded-lg overflow-hidden w-full transition-colors hover:bg-primary/10",
                            currentThreadId === thread.id && "bg-primary/15",
                          )}
                          onClick={() => {
                            if (currentThreadId === thread.id) {
                              return
                            }
                            navigate(ROUTES.CHAT_THREAD(thread.id))
                          }}
                        >
                          <span className="truncate text-sm font-medium flex-1">{thread.title}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover/thread:opacity-100 transition-opacity ml-2 h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={(event) => handleDeleteThread(thread._id, event)}
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </Authenticated>
          
          <Unauthenticated>
            <SidebarGroup className="px-4">
              <div className="flex flex-col items-center justify-center text-center py-8 px-4">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Login to Save Chat Threads</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Sign in with Google to save your conversations and access them from any device.
                </p>
                <SignInButton mode="modal">
                  <Button size="sm" className="gap-2">
                    <LogIn size={16} />
                    Sign In
                  </Button>
                </SignInButton>
              </div>
            </SidebarGroup>
          </Unauthenticated>
        </SidebarContent>
        <Footer />
      </Sidebar>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "fixed top-3 z-50 h-8 w-8 rounded-full bg-background/50 backdrop-blur-sm",
          "transition-all duration-300 ease-in-out",
          isCollapsed ? "left-3" : "left-[16.5rem]",
        )}
        onClick={toggle}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>
    </>
  )
}

function PureHeader() {
  return (
    <SidebarHeader className="border-b px-4 py-4">
      <div className="flex items-center justify-center mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={22} className="shrink-0" />
          <h1 className="text-xl font-bold tracking-tight">
            Chat<span className="text-primary">Studio</span>
          </h1>
        </div>
      </div>
      
      <Link
        to={ROUTES.CHAT}
        className={cn(
          buttonVariants({
            variant: "default",
            size: "sm",
          }),
          "w-full justify-center gap-2 h-9"
        )}
      >
        <Plus size={16} />
        New Chat
      </Link>
    </SidebarHeader>
  )
}

const Header = memo(PureHeader)

const PureFooter = () => {
  const navigate = useNavigate()
  const { user } = useUser()

  return (
    <SidebarFooter className="border-t p-4 space-y-2">
      <Authenticated>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 h-12 p-3 hover:bg-accent/50"
          onClick={() => navigate(ROUTES.SETTINGS)}
        >
          <UserButton 
            appearance={{
              elements: {
                avatarBox: "w-8 h-8"
              }
            }}
          />
          <div className="flex flex-col items-start min-w-0 flex-1">
            <span className="text-sm font-medium truncate w-full">
              {user?.fullName || user?.firstName || "User"}
            </span>
            <span className="text-xs text-muted-foreground truncate w-full">
              {user?.primaryEmailAddress?.emailAddress}
            </span>
          </div>
          <Settings size={16} className="text-muted-foreground" />
        </Button>
      </Authenticated>
      
      <Unauthenticated>
        <Link 
          to={ROUTES.SETTINGS} 
          className={cn(
            buttonVariants({ 
              variant: "outline",
              size: "sm"
            }),
            "w-full justify-center gap-2 h-9"
          )}
        >
          <Settings size={16} />
          Settings
        </Link>
      </Unauthenticated>
    </SidebarFooter>
  )
}

const Footer = memo(PureFooter)
