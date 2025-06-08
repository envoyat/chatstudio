"use client"

import { useEffect } from "react"
import { useNavigate } from "react-router"

export default function Index() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate("/chat")
  }, [navigate])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Chat0</h1>
        <p className="text-muted-foreground">Redirecting to chat...</p>
      </div>
    </div>
  )
}
