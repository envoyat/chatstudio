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
} from "@/components/ui/sidebar"
import { Button, buttonVariants } from "@/components/ui/button"
import { deleteThread, getThreads } from "@/frontend/storage/queries"
import { useLiveQuery, triggerUpdate } from "@/frontend/hooks/useLiveQuery"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { memo } from "react"

export default function ChatSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const threads = useLiveQuery(() => getThreads(), [])

  // Extract thread ID from various possible paths
  const currentThreadId = location.pathname.includes("/chat/") ? location.pathname.split("/chat/")[1] : null

  return (
    <Sidebar>
      <div className="flex flex-col h-full p-2">
        <Header />
        <SidebarContent className="no-scrollbar">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {threads?.map((thread) => {
                  return (
                    <SidebarMenuItem key={thread.id}>
                      <div
                        className={cn(
                          "cursor-pointer group/thread h-9 flex items-center px-2 py-1 rounded-[8px] overflow-hidden w-full hover:bg-secondary",
                          currentThreadId === thread.id && "bg-secondary",
                        )}
                        onClick={() => {
                          if (currentThreadId === thread.id) {
                            return
                          }
                          navigate(`/chat/${thread.id}`)
                        }}
                      >
                        <span className="truncate block">{thread.title}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hidden group-hover/thread:flex ml-auto h-7 w-7"
                          onClick={async (event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            await deleteThread(thread.id)
                            triggerUpdate()
                            navigate(`/chat`)
                          }}
                        >
                          <X size={16} />
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
      </div>
    </Sidebar>
  )
}

function PureHeader() {
  return (
    <SidebarHeader className="flex justify-between items-center gap-4 relative">
      <SidebarTrigger className="absolute right-1 top-2.5" />
      <h1 className="text-2xl font-bold">
        Chat<span className="">0</span>
      </h1>
      <Link
        to="/chat"
        className={buttonVariants({
          variant: "default",
          className: "w-full",
        })}
      >
        New Chat
      </Link>
    </SidebarHeader>
  )
}

const Header = memo(PureHeader)

const PureFooter = () => {
  return (
    <SidebarFooter>
      <Link to="/settings" className={buttonVariants({ variant: "outline" })}>
        Settings
      </Link>
    </SidebarFooter>
  )
}

const Footer = memo(PureFooter)
