"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Check, Copy, RefreshCcw, SquarePen } from "lucide-react"
import type { UIMessage } from "ai"
import { useConvexAuth, useMutation } from "convex/react"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import { useModelStore } from "../stores/ModelStore"
import { useAPIKeyStore } from "../stores/APIKeyStore"

interface MessageControlsProps {
  message: UIMessage;
  messages: UIMessage[]; // The full list of messages in the chat
  setMode: (mode: "view" | "edit") => void;
  convexThreadId: Id<"threads"> | null;
}

export default function MessageControls({
  message,
  messages,
  setMode,
  convexThreadId,
}: MessageControlsProps) {
  const [copied, setCopied] = useState(false)
  const { isAuthenticated } = useConvexAuth()
  const deleteTrailingMessages = useMutation(api.messages.deleteTrailing)
  const sendMessage = useMutation(api.messages.send)
  
  const { selectedModel } = useModelStore()
  const { hasUserKey, getKey } = useAPIKeyStore()
  const { getModelConfig } = useModelStore()

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = async () => {
    if (!isAuthenticated || !convexThreadId || !message.createdAt) return;

    let contentToResend: string | null = null;
    let timestampToDeleteFrom: number;
    let inclusiveDelete: boolean;

    if (message.role === 'user') {
      // --- THIS IS THE FIX ---
      // We now treat "Rerun" just like "Edit".
      // We delete the user message itself AND everything after it.
      contentToResend = message.content;
      timestampToDeleteFrom = message.createdAt.getTime();
      inclusiveDelete = true; // This is the change. Delete the user message too.
    } else if (message.role === 'assistant') {
      // --- FIX for Regenerating an AI Message ---
      // Find the user message that came right before this assistant message.
      const currentMessageIndex = messages.findIndex(m => m.id === message.id);
      const previousMessage = messages[currentMessageIndex - 1];

      if (previousMessage && previousMessage.role === 'user') {
        contentToResend = previousMessage.content;
        // We want to delete this assistant message and everything after it.
        timestampToDeleteFrom = message.createdAt.getTime();
        inclusiveDelete = true; // DO delete the assistant message we're regenerating.
      } else {
        toast.error("Could not find the user prompt for this response.");
        return;
      }
    } else {
      return;
    }

    if (contentToResend === null) {
        toast.error("Could not determine which message to rerun.");
        return;
    }
    
    try {
      // Step 1: Delete the correct trailing messages from the database.
      await deleteTrailingMessages({
        threadId: convexThreadId,
        fromCreatedAt: timestampToDeleteFrom,
        inclusive: inclusiveDelete,
      });

      // Step 2: Send a new message with the determined content. This re-creates the
      // user message and triggers the new AI response.
      const modelConfig = getModelConfig();
      const userApiKeyForModel = hasUserKey(modelConfig.provider) ? getKey(modelConfig.provider) || undefined : undefined;

      await sendMessage({
        threadId: convexThreadId,
        content: contentToResend,
        model: selectedModel,
        userApiKey: userApiKeyForModel,
      });

      toast.success("Regenerating response...");

    } catch (error) {
      console.error("Failed to regenerate response:", error);
      toast.error("Failed to regenerate response.");
    }
  }

  return (
    <div
      className={cn("opacity-0 group-hover:opacity-100 transition-opacity duration-100 flex gap-1", {
        "absolute mt-5 right-2": message.role === "user",
      })}
    >
      <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy">
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </Button>
      
      {/* Only show Edit button for user messages */}
      {message.role === "user" && isAuthenticated && (
        <Button variant="ghost" size="icon" onClick={() => setMode("edit")} title="Edit">
          <SquarePen className="w-4 h-4" />
        </Button>
      )}

      {/* Rerun from a user message. Re-prompts the AI with the same content. */}
      {message.role === "user" && isAuthenticated && (
        <Button variant="ghost" size="icon" onClick={handleRegenerate} title="Rerun">
          <RefreshCcw className="w-4 h-4" />
        </Button>
      )}

       {/* Regenerate an assistant message. Deletes it and reruns the previous prompt. */}
       {message.role === "assistant" && isAuthenticated && (
        <Button variant="ghost" size="icon" onClick={handleRegenerate} title="Regenerate">
          <RefreshCcw className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}
