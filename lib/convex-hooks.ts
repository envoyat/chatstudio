import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Thread hooks
export function useThreads() {
  return useQuery(api.threads.list);
}

export function useThread(threadId: Id<"threads"> | undefined) {
  return useQuery(api.threads.get, threadId ? { threadId } : "skip");
}

export function useThreadByUuid(uuid: string | undefined) {
  return useQuery(api.threads.getByUuid, uuid ? { uuid } : "skip");
}

export function useCreateThread() {
  return useMutation(api.threads.create);
}

export function useUpdateThread() {
  return useMutation(api.threads.update);
}

export function useDeleteThread() {
  return useMutation(api.threads.remove);
}

// Message hooks
export function useMessages(threadId: Id<"threads"> | undefined) {
  return useQuery(api.messages.list, threadId ? { threadId } : "skip");
}

export function useMessagesByUuid(uuid: string | undefined) {
  const thread = useThreadByUuid(uuid);
  const threadId = thread?._id;
  return useQuery(api.messages.list, threadId ? { threadId } : "skip");
}

export function useCreateMessage() {
  return useMutation(api.messages.create);
}

export function useDeleteTrailingMessages() {
  return useMutation(api.messages.deleteTrailing);
} 