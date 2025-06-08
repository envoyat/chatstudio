"use client"

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button, buttonVariants } from "@/components/ui/button"
import { deleteThread, getThreads } from "@/frontend/storage/queries"
import { useLiveQuery, triggerUpdate } from "@/frontend/hooks/useLiveQuery"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { X, Plus, MessageSquare, Settings, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { memo } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default function ChatSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const threads = useLiveQuery(() => getThreads(), [])
  const { state } = useSidebar()

  // Extract thread ID from various possible paths
  const currentThreadId = location.pathname.includes("/chat/") ? location.pathname.split("/chat/")[1] : null
  const isCollapsed = state === "collapsed"

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar>
        <Header />
        <SidebarContent className="flex-1 overflow-hidden">
          <SidebarGroup className={cn("px-2", isCollapsed && "px-1")}>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {threads?.map((thread) => {
                  const threadItem = (
                    <div
                      className={cn(
                        "cursor-pointer group/thread flex items-center overflow-hidden w-full transition-colors hover:bg-accent/50 rounded-lg",
                        currentThreadId === thread.id && "bg-accent",
                        isCollapsed ? "h-10 px-2 py-2 justify-center" : "h-10 px-3 py-2"
                      )}
                      onClick={() => {
                        if (currentThreadId === thread.id) {
                          return
                        }
                        navigate(`/chat/${thread.id}`)
                      }}
                    >
                      {isCollapsed ? (
                        <MessageSquare size={16} className="shrink-0" />
                      ) : (
                        <>
                          <MessageSquare size={16} className="shrink-0 mr-3" />
                          <span className="truncate text-sm font-medium flex-1">{thread.title}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover/thread:opacity-100 transition-opacity ml-2 h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={async (event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              await deleteThread(thread.id)
                              triggerUpdate()
                              navigate(`/chat`)
                            }}
                          >
                            <X size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  )

                  return (
                    <SidebarMenuItem key={thread.id}>
                      {isCollapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{threadItem}</TooltipTrigger>
                          <TooltipContent side="right" className="font-medium">
                            {thread.title}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        threadItem
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <Footer />
      </Sidebar>
    </TooltipProvider>
  )
}

function PureHeader() {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <SidebarHeader className={cn("border-b transition-all duration-300", isCollapsed ? "px-2 py-3" : "px-4 py-4")}>
      <div className={cn("flex items-center", isCollapsed ? "justify-center mb-2" : "justify-between mb-4")}>
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              Chat<span className="text-primary">Studio</span>
            </h1>
          </div>
        )}
        <SidebarTrigger className="h-8 w-8">
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </SidebarTrigger>
      </div>
      
      {isCollapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/chat"
              className={cn(
                buttonVariants({
                  variant: "default",
                  size: "sm",
                }),
                "w-8 h-8 p-0"
              )}
            >
              <Plus size={16} />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            New Chat
          </TooltipContent>
        </Tooltip>
      ) : (
        <Link
          to="/chat"
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
      )}
    </SidebarHeader>
  )
}

const Header = memo(PureHeader)

const PureFooter = () => {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <SidebarFooter className={cn("border-t transition-all duration-300", isCollapsed ? "p-2" : "p-4")}>
      {isCollapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link 
              to="/settings" 
              className={cn(
                buttonVariants({ 
                  variant: "outline",
                  size: "sm"
                }),
                "w-8 h-8 p-0"
              )}
            >
              <Settings size={16} />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            Settings
          </TooltipContent>
        </Tooltip>
      ) : (
        <Link 
          to="/settings" 
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
      )}
    </SidebarFooter>
  )
}

const Footer = memo(PureFooter)
