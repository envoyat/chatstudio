import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Conversation hooks
export function useConversations() {
  return useQuery(api.conversations.listWithLastMessage);
}

export function useConversation(conversationId: Id<"conversations"> | undefined) {
  return useQuery(api.conversations.get, conversationId ? { conversationId } : "skip");
}

export function useConversationByUuid(uuid: string | undefined) {
  return useQuery(api.conversations.getByUuid, uuid ? { uuid } : "skip");
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
export function useMessages(conversationId: Id<"conversations"> | undefined) {
  return useQuery(api.messages.list, conversationId ? { conversationId } : "skip");
}

export function useMessagesByUuid(uuid: string | undefined) {
  const conversation = useConversationByUuid(uuid);
  const conversationId = conversation?._id;
  return useQuery(api.messages.list, conversationId ? { conversationId } : "skip");
}

export function useSendMessage() {
  return useMutation(api.messages.send);
}

export function useDeleteTrailingMessages() {
  return useMutation(api.messages.deleteTrailing);
} 