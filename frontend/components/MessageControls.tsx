"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Check, Copy, RefreshCcw, SquarePen, GitFork, Share2, Globe } from "lucide-react"
import type { UIMessage } from "ai"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import { useModelStore } from "../stores/ModelStore"
import { useAPIKeyStore } from "../stores/APIKeyStore"
import { ROUTES } from "../constants/routes"
import { MESSAGE_ROLES } from "@/convex/constants"

interface MessageControlsProps {
  message: UIMessage;
  messages: UIMessage[]; // The full list of messages in the chat
  setMode: (mode: "view" | "edit") => void;
  convexConversationId: Id<"conversations"> | null;
}

export default function MessageControls({
  message,
  messages,
  setMode,
  convexConversationId,
}: MessageControlsProps) {
  const [copied, setCopied] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const { isAuthenticated } = useConvexAuth()
  const navigate = useNavigate()
  const deleteTrailingMessages = useMutation(api.messages.deleteTrailing)
  const sendMessage = useMutation(api.messages.send)
  const branchConversation = useMutation(api.conversations.branch)
  const togglePublic = useMutation(api.conversations.togglePublic)
  
  const { selectedModel } = useModelStore()
  const { hasUserKey, getKey } = useAPIKeyStore()
  const { getModelConfig } = useModelStore()

  // Get conversation details to show share status
  const conversation = useQuery(api.conversations.getById, 
    convexConversationId ? { conversationId: convexConversationId } : "skip"
  );

  // Update isPublic state when conversation changes
  useEffect(() => {
    if (conversation) {
      setIsPublic(conversation.isPublic ?? false);
    }
  }, [conversation]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleBranch = async () => {
    if (!isAuthenticated || !convexConversationId) {
      toast.error("You must be logged in to branch a conversation.");
      return;
    }

    toast.info("Creating a new branch...");
    try {
      const result = await branchConversation({
        originalConversationId: convexConversationId,
        branchPointMessageId: message.id as Id<"messages">,
      });
      toast.success("Conversation branched successfully!");
      navigate(ROUTES.CHAT_THREAD(result.newConversationUuid));
    } catch (error) {
      console.error("Failed to branch conversation:", error);
      toast.error("Failed to branch conversation.");
    }
  };

  const handleRegenerate = async () => {
    if (!isAuthenticated || !convexConversationId || !message.createdAt) return;

    let contentToResend: string | null = null;
    let timestampToDeleteFrom: number;
    let inclusiveDelete: boolean;

    if (message.role === MESSAGE_ROLES.USER) {
      contentToResend = message.content;
      timestampToDeleteFrom = message.createdAt.getTime();
      inclusiveDelete = true;
    } else if (message.role === MESSAGE_ROLES.ASSISTANT) {
      const currentMessageIndex = messages.findIndex(m => m.id === message.id);
      const previousMessage = messages[currentMessageIndex - 1];

      if (previousMessage && previousMessage.role === MESSAGE_ROLES.USER) {
        contentToResend = previousMessage.content;
        timestampToDeleteFrom = message.createdAt.getTime();
        inclusiveDelete = true;
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
      await deleteTrailingMessages({
        conversationId: convexConversationId,
        fromCreatedAt: timestampToDeleteFrom,
        inclusive: inclusiveDelete,
      });

      const modelConfig = getModelConfig();
      const userApiKeyForModel = hasUserKey(modelConfig.provider) ? getKey(modelConfig.provider) || undefined : undefined;

      await sendMessage({
        conversationId: convexConversationId,
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

  const handleShare = async () => {
    if (!isAuthenticated || !convexConversationId) return;

    try {
      const newIsPublic = await togglePublic({ conversationId: convexConversationId });
      setIsPublic(newIsPublic);
      
      if (newIsPublic) {
        if (!conversation) {
          toast.error("Could not generate share link: conversation not found.");
          return;
        }
        const shareUrl = `${window.location.origin}/chat/${conversation.uuid}`;
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Share link copied to clipboard!");
      } else {
        toast.success("Conversation is now private");
      }
    } catch (error) {
      console.error("Failed to toggle sharing:", error);
      toast.error("Failed to toggle sharing");
    }
  }

  return (
    <div
      className={cn("opacity-0 group-hover:opacity-100 transition-opacity duration-100 flex gap-1", {
        "absolute mt-5 right-2": message.role === MESSAGE_ROLES.USER,
        "mt-2": message.role === MESSAGE_ROLES.ASSISTANT,
      })}
    >
      <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy">
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </Button>
      
      {/* Only show Edit button for user messages */}
      {message.role === MESSAGE_ROLES.USER && isAuthenticated && (
        <Button variant="ghost" size="icon" onClick={() => setMode("edit")} title="Edit">
          <SquarePen className="w-4 h-4" />
        </Button>
      )}

      {/* Rerun from a user message. Re-prompts the AI with the same content. */}
      {message.role === MESSAGE_ROLES.USER && isAuthenticated && (
        <Button variant="ghost" size="icon" onClick={handleRegenerate} title="Rerun">
          <RefreshCcw className="w-4 h-4" />
        </Button>
      )}

       {/* Regenerate an assistant message. Deletes it and reruns the previous prompt. */}
       {message.role === MESSAGE_ROLES.ASSISTANT && isAuthenticated && (
        <>
          <Button variant="ghost" size="icon" onClick={handleRegenerate} title="Regenerate">
            <RefreshCcw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleBranch} title="Branch from here">
            <GitFork className="w-4 h-4" />
          </Button>
        </>
      )}

      {/* Share button - only show for the last message */}
      {isAuthenticated && message.id === messages[messages.length - 1].id && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleShare} 
          title={isPublic ? "Make private" : "Share conversation"}
        >
          <Share2 className={cn("w-4 h-4", isPublic && "text-primary")} />
        </Button>
      )}
    </div>
  )
}
