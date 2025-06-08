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
import { deleteThread, getThreads } from "@/frontend/storage/queries"
import { useLiveQuery, triggerUpdate } from "@/frontend/hooks/useLiveQuery"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { X, Plus, MessageSquare, Settings, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { memo } from "react"

export default function ChatSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const threads = useLiveQuery(() => getThreads(), [])
  const { state, toggle } = useSidebar()

  // Extract thread ID from various possible paths
  const currentThreadId = location.pathname.includes("/chat/") ? location.pathname.split("/chat/")[1] : null
  const isCollapsed = state === "collapsed"

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
          <SidebarGroup className="px-2">
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {threads?.map((thread) => {
                  return (
                    <SidebarMenuItem key={thread.id}>
                      <div
                        className={cn(
                          "cursor-pointer group/thread h-10 flex items-center px-3 py-2 rounded-lg overflow-hidden w-full transition-colors hover:bg-accent/50",
                          currentThreadId === thread.id && "bg-accent",
                        )}
                        onClick={() => {
                          if (currentThreadId === thread.id) {
                            return
                          }
                          navigate(`/chat/${thread.id}`)
                        }}
                      >
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
                      </div>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">
            Chat<span className="text-primary">Studio</span>
          </h1>
        </div>
      </div>
      
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
    </SidebarHeader>
  )
}

const Header = memo(PureHeader)

const PureFooter = () => {
  return (
    <SidebarFooter className="border-t p-4">
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
    </SidebarFooter>
  )
}

const Footer = memo(PureFooter)
