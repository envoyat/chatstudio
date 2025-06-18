import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";

// Conversation hooks
export function useListConversations(sessionId: string | null) {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.conversations.list, isAuthenticated ? {} : (sessionId ? { sessionId } : {}));
}

export function useConversations(sessionId: string | null) {
  const { isAuthenticated } = useConvexAuth()
  return useQuery(api.conversations.listWithLastMessage, isAuthenticated ? {} : (sessionId ? { sessionId } : {}));
}

export function useConversation(conversationId: Id<"conversations"> | undefined) {
  return useQuery(api.conversations.getById, conversationId ? { conversationId } : "skip");
}

export function useConversationByUuid(uuid: string | undefined, sessionId: string | null) {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.conversations.getByUuid, uuid ? { uuid, ...(isAuthenticated ? {} : (sessionId ? { sessionId } : {})) } : "skip");
}

export function useCreateConversation() {
  return useMutation(api.conversations.create);
}

export function useUpdateConversation() {
  return useMutation(api.conversations.update);
}

export function useDeleteConversation() {
  return useMutation(api.conversations.remove);
}

// Message hooks
export function useMessages(conversationId: Id<"conversations"> | undefined, sessionId: string | null) {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.messages.list, conversationId ? { conversationId, ...(isAuthenticated ? {} : (sessionId ? { sessionId } : {})) } : "skip");
}

export function useMessagesByUuid(uuid: string | undefined, sessionId: string | null) {
  const conversation = useConversationByUuid(uuid, sessionId);
  const conversationId = conversation?._id;
  return useMessages(conversationId, sessionId);
}

export function useSendMessage() {
  return useMutation(api.messages.send);
}

export function useDeleteTrailingMessages() {
  return useMutation(api.messages.deleteTrailing);
} 