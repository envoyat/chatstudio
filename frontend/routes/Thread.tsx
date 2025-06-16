"use client"

import Chat from "@/frontend/components/Chat"
import { useParams } from "react-router-dom"

export default function Thread() {
  const { id } = useParams()
  if (!id) throw new Error("Conversation ID is required")

  // The Chat component now handles all message loading internally using the persistent reactivity pattern
  return <Chat key={id} threadId={id} />
}
