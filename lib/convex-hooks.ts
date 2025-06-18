import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSessionStore } from "@/frontend/stores/sessionStore";
import { useConvexAuth } from "convex/react";

// Conversation hooks
export function useConversations() {
  return useQuery(api.conversations.listWithLastMessage);
}

export function useConversation(
  conversationId: Id<"conversations"> | undefined,
) {
  const { isAuthenticated } = useConvexAuth();
  const sessionId = useSessionStore((state) => state.sessionId);
  return useQuery(
    api.conversations.getById,
    conversationId ? { conversationId, sessionId: isAuthenticated ? undefined : sessionId || undefined } : "skip",
  );
}

export function useConversationByUuid(uuid: string | undefined) {
  const { isAuthenticated } = useConvexAuth();
  const sessionId = useSessionStore((state) => state.sessionId);
  return useQuery(
    api.conversations.getByUuid,
    uuid ? { uuid, sessionId: isAuthenticated ? undefined : sessionId || undefined } : "skip",
  );
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
export function useMessages(
  conversationId: Id<"conversations"> | undefined,
) {
  const { isAuthenticated } = useConvexAuth();
  const sessionId = useSessionStore((state) => state.sessionId);
  return useQuery(
    api.messages.list,
    conversationId ? { conversationId, sessionId: isAuthenticated ? undefined : sessionId || undefined } : "skip",
  );
}

export function useMessagesByUuid(uuid: string | undefined) {
  const conversation = useConversationByUuid(uuid);
  const conversationId = conversation?._id;
  return useMessages(conversationId);
}

export function useSendMessage() {
  return useMutation(api.messages.send);
}

export function useDeleteTrailingMessages() {
  return useMutation(api.messages.deleteTrailing);
}

export function useClearGuestData() {
  return useMutation(api.conversations.clearGuestData);
} 