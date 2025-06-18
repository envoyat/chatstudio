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
import { useIsMobile } from "@/hooks/use-mobile"
import { Button, buttonVariants } from "@/components/ui/button"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { X, Plus, Settings, ChevronLeft, ChevronRight, MessageSquare, LogIn, Loader2, GitFork, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { memo } from "react"
import { Authenticated, Unauthenticated, useConvexAuth, useQuery } from "convex/react"
import { SignInButton, UserButton, useUser } from "@clerk/nextjs"
import { useConversations, useDeleteConversation } from "@/lib/convex-hooks"
import type { Id } from "@/convex/_generated/dataModel"
import { ROUTES } from "@/frontend/constants/routes"
import { MESSAGE_ROLES } from "@/convex/constants"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const StreamingSpinner = () => (
  <Loader2 size={16} className="animate-spin text-primary" />
);

export default function ChatSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, toggle } = useSidebar()
  const { isAuthenticated } = useConvexAuth()
  const sidebarRef = React.useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  // Use the updated hook which now includes last message info.
  const conversations = useConversations()
  const deleteConversationMutation = useDeleteConversation()

  // Extract conversation ID from various possible paths
  const currentConversationId = location.pathname.includes("/chat/") ? location.pathname.split("/chat/")[1] : null
  const isCollapsed = state === "collapsed"
  
  // Debug state changes
  React.useEffect(() => {
    console.log('[Sidebar] State changed:', state, 'isCollapsed:', isCollapsed)
  }, [state, isCollapsed])



  // Handle click outside (only on mobile)
  React.useEffect(() => {
    if (!isMobile) return
    
    const handleClickOutside = (event: MouseEvent) => {
      console.log('[Sidebar] Click outside detected')
      console.log('[Sidebar] isCollapsed:', isCollapsed)
      console.log('[Sidebar] Contains target:', sidebarRef.current?.contains(event.target as Node))
      
      // Check if the click is on the toggle button or its children
      const toggleButton = document.querySelector('[data-sidebar-toggle]')
      const isToggleButtonClick = toggleButton && (toggleButton === event.target || toggleButton.contains(event.target as Node))
      
      if (!isCollapsed && sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && !isToggleButtonClick) {
        console.log('[Sidebar] Toggling from click outside')
        toggle()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isCollapsed, toggle, isMobile])

  const handleDeleteConversation = async (convexConversationId: Id<"conversations">, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    if (isAuthenticated) {
      // Use Convex mutation for authenticated users
      try {
        // Pass the actual Convex ID
        await deleteConversationMutation({ conversationId: convexConversationId })
        navigate(ROUTES.CHAT)
      } catch (error) {
        console.error('Failed to delete conversation:', error)
      }
    }
  }

  // Handle sidebar toggle
  const handleSidebarToggle = () => {
    console.log('[Sidebar] Toggle button clicked')
    console.log('[Sidebar] Current state:', state)
    console.log('[Sidebar] isCollapsed:', isCollapsed)
    console.log('[Sidebar] isMobile:', isMobile)
    toggle()
    console.log('[Sidebar] Toggle called')
  }

  return (
    <>
      {/* Mobile backdrop blur */}
      {isMobile && !isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => {
            console.log('[Sidebar] Backdrop clicked')
            toggle()
          }}
        />
      )}
      
      <Sidebar
        ref={sidebarRef}
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden z-50",
          isMobile 
            ? cn(
                "fixed left-0 top-0 h-full",
                isCollapsed ? "-translate-x-full w-64" : "translate-x-0 w-64"
              )
            : cn(
                isCollapsed ? "w-0" : "w-64"
              )
        )}
      >
        <Header />
        <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
          <Authenticated>
            <SidebarGroup className="px-0">
              <SidebarGroupContent>
                <TooltipProvider delayDuration={100}>
                  <SidebarMenu className="space-y-1">
                    {conversations?.map((conversation) => {
                      // Logic for streaming state
                      const isStreaming = conversation.lastMessage?.role === MESSAGE_ROLES.ASSISTANT && conversation.lastMessage.isComplete === false;
                      
                      return (
                        <SidebarMenuItem key={conversation.uuid}>
                          <Link
                            to={ROUTES.CHAT_THREAD(conversation.uuid)}
                            className={cn(
                              "cursor-pointer group/thread h-10 flex items-center px-2 py-2 rounded-lg overflow-hidden w-full transition-colors hover:bg-primary/10",
                              currentConversationId === conversation.uuid && "bg-primary/15",
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">{conversation.title}</span>
                                {conversation.isBranched && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <GitFork className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                      <p>Branched from '{conversation.branchedFromTitle}'</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {conversation.isPublic && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                      <p>Shared by {conversation.ownerName || "an anonymous user"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </div>

                            {isStreaming ? (
                              <div className="flex items-center gap-2 ml-2">
                                <StreamingSpinner />
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover/thread:opacity-100 transition-opacity ml-2 h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                                onClick={(event) => handleDeleteConversation(conversation._id, event)}
                              >
                                <X size={14} />
                              </Button>
                            )}
                          </Link>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </TooltipProvider>
              </SidebarGroupContent>
            </SidebarGroup>
          </Authenticated>
          
          <Unauthenticated>
            <SidebarGroup className="px-4">
              <div className="flex flex-col items-center justify-center text-center py-8 px-4">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Login to Save Chat Conversations</h3>
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
        data-sidebar-toggle
        className={cn(
          "fixed top-3 z-[60] h-8 w-8 rounded-full bg-background/50 backdrop-blur-sm",
          "transition-all duration-300 ease-in-out",
          isMobile 
            ? "left-3" // Always in same position on mobile
            : (isCollapsed ? "left-3" : "left-[16.5rem]"), // Desktop behavior
        )}
        onClick={handleSidebarToggle}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>
    </>
  )
}

function PureHeader() {
  return (
    <SidebarHeader className="px-4 py-4 !border-b-0">
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
    <SidebarFooter className="p-4 space-y-2 !border-t-0">
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
