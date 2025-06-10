import type { UIMessage } from "ai";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { anonymousStorage } from "./anonymous-storage";
import { useEffect, useState } from "react";
import { triggerUpdate } from "../hooks/useLiveQuery";

// Types that match the original localStorage interface but use Convex IDs
export interface ConvexThread {
  _id: Id<"threads">;
  title: string;
  userId?: Id<"users">;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
}

export interface ConvexMessage {
  _id: Id<"messages">;
  threadId: Id<"threads">;
  userId?: Id<"users">;
  parts: UIMessage["parts"];
  content: string;
  role: "user" | "assistant" | "system" | "data";
  createdAt: number;
}

export interface ConvexMessageSummary {
  _id: Id<"messageSummaries">;
  threadId: Id<"threads">;
  messageId: Id<"messages">;
  userId?: Id<"users">;
  content: string;
  createdAt: number;
}

// Hook to check if user is authenticated
export const useAuthStatus = () => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return { isAuthenticated, isLoading };
};

// Convert Convex thread to legacy Thread format
const convertThread = (convexThread: ConvexThread) => ({
  id: convexThread._id,
  title: convexThread.title,
  createdAt: new Date(convexThread.createdAt),
  updatedAt: new Date(convexThread.updatedAt),
  lastMessageAt: new Date(convexThread.lastMessageAt),
});

// Convert Convex message to legacy DBMessage format
const convertMessage = (convexMessage: ConvexMessage) => ({
  id: convexMessage._id,
  threadId: convexMessage.threadId,
  parts: convexMessage.parts,
  content: convexMessage.content,
  role: convexMessage.role,
  createdAt: new Date(convexMessage.createdAt),
});

// Convert Convex message summary to legacy MessageSummary format
const convertMessageSummary = (convexSummary: ConvexMessageSummary) => ({
  id: convexSummary._id,
  threadId: convexSummary.threadId,
  messageId: convexSummary.messageId,
  content: convexSummary.content,
  createdAt: new Date(convexSummary.createdAt),
});

// Hooks for queries
export const useGetThreads = () => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [anonymousThreads, setAnonymousThreads] = useState<any[]>([]);
  const convexThreads = useQuery(api.threads.getThreads);

  // Listen for anonymous storage updates
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      const updateAnonymousThreads = () => {
        const threads = anonymousStorage.getThreads();
        setAnonymousThreads(threads.map(thread => ({
          id: thread.id,
          title: thread.title,
          createdAt: new Date(thread.createdAt),
          updatedAt: new Date(thread.updatedAt),
          lastMessageAt: new Date(thread.lastMessageAt),
        })));
      };

      updateAnonymousThreads();

      const handleStorageChange = () => {
        updateAnonymousThreads();
      };

      window.addEventListener("chatstudio-update", handleStorageChange);
      return () => window.removeEventListener("chatstudio-update", handleStorageChange);
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) return [];
  if (isAuthenticated) {
    return convexThreads?.map(convertThread) || [];
  }
  return anonymousThreads;
};

export const useGetMessagesByThreadId = (threadId: Id<"threads"> | string | null) => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [anonymousMessages, setAnonymousMessages] = useState<any[]>([]);
  const convexMessages = useQuery(
    api.messages.getMessagesByThreadId, 
    (threadId && isAuthenticated) ? { threadId: threadId as Id<"threads"> } : "skip"
  );

  // Listen for anonymous storage updates
  useEffect(() => {
    if (!isAuthenticated && !isLoading && threadId) {
      const updateAnonymousMessages = () => {
        const messages = anonymousStorage.getMessagesByThreadId(threadId as string);
        setAnonymousMessages(messages.map(message => ({
          id: message.id,
          threadId: message.threadId,
          parts: message.parts,
          content: message.content,
          role: message.role,
          createdAt: new Date(message.createdAt),
        })));
      };

      updateAnonymousMessages();

      const handleStorageChange = () => {
        updateAnonymousMessages();
      };

      window.addEventListener("chatstudio-update", handleStorageChange);
      return () => window.removeEventListener("chatstudio-update", handleStorageChange);
    }
  }, [isAuthenticated, isLoading, threadId]);

  if (isLoading) return [];
  if (isAuthenticated && threadId) {
    return convexMessages?.map(convertMessage) || [];
  }
  if (!isAuthenticated && threadId) {
    return anonymousMessages;
  }
  return [];
};

export const useGetMessageSummaries = (threadId: Id<"threads"> | null) => {
  const summaries = useQuery(api.messageSummaries.getMessageSummaries,
    threadId ? { threadId } : "skip"
  );
  return summaries?.map(convertMessageSummary) || [];
};

// Hooks for mutations
export const useCreateThread = () => {
  const { isAuthenticated } = useConvexAuth();
  const convexMutation = useMutation(api.threads.createThread);
  
  return async (args: { id: string; title?: string }) => {
    if (isAuthenticated) {
      return await convexMutation(args);
    } else {
      // Handle anonymous thread creation
      const now = Date.now();
      anonymousStorage.addThread({
        id: args.id,
        title: args.title || "New Chat",
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
      });
      triggerUpdate();
      return args.id; // Return the client-generated ID
    }
  };
};

export const useUpdateThread = () => {
  return useMutation(api.threads.updateThread);
};

export const useDeleteThread = () => {
  const { isAuthenticated } = useConvexAuth();
  const convexMutation = useMutation(api.threads.deleteThread);
  
  return async (args: { threadId: Id<"threads"> | string }) => {
    if (isAuthenticated) {
      return await convexMutation({ threadId: args.threadId as Id<"threads"> });
    } else {
      // Handle anonymous thread deletion
      anonymousStorage.deleteThread(args.threadId as string);
      triggerUpdate();
    }
  };
};

export const useDeleteAllThreads = () => {
  return useMutation(api.threads.deleteAllThreads);
};

export const useCreateMessage = () => {
  const { isAuthenticated } = useConvexAuth();
  const convexMutation = useMutation(api.messages.createMessage);
  
  return async (args: {
    threadId: Id<"threads"> | string;
    messageId: string;
    parts: any;
    content: string;
    role: "user" | "assistant" | "system" | "data";
    createdAt?: number;
  }) => {
    if (isAuthenticated) {
      return await convexMutation({
        ...args,
        threadId: args.threadId as Id<"threads">,
      });
    } else {
      // Handle anonymous message creation
      const now = args.createdAt || Date.now();
      anonymousStorage.addMessage({
        id: args.messageId,
        threadId: args.threadId as string,
        parts: args.parts,
        content: args.content,
        role: args.role,
        createdAt: now,
      });
      
      // Update thread's lastMessageAt
      anonymousStorage.updateThread(args.threadId as string, {
        lastMessageAt: now,
        updatedAt: now,
      });
      
      triggerUpdate();
      return args.messageId;
    }
  };
};

export const useDeleteTrailingMessages = () => {
  const { isAuthenticated } = useConvexAuth();
  const convexMutation = useMutation(api.messages.deleteTrailingMessages);
  
  return async (args: {
    threadId: Id<"threads"> | string;
    createdAt: number;
    gte?: boolean;
  }) => {
    if (isAuthenticated) {
      return await convexMutation({
        threadId: args.threadId as Id<"threads">,
        createdAt: args.createdAt,
        gte: args.gte,
      });
    } else {
      // Handle anonymous message deletion
      anonymousStorage.deleteTrailingMessages(
        args.threadId as string,
        args.createdAt,
        args.gte
      );
      triggerUpdate();
    }
  };
};

export const useCreateMessageSummary = () => {
  return useMutation(api.messageSummaries.createMessageSummary);
};

// Async function equivalents for compatibility with existing code
export const getThreads = async () => {
  // This will be handled by the useGetThreads hook in React components
  throw new Error("Use useGetThreads hook instead of async getThreads");
};

export const createThread = async (id: string): Promise<void> => {
  // This will be handled by the useCreateThread hook in React components
  throw new Error("Use useCreateThread hook instead of async createThread");
};

export const updateThread = async (id: string, title: string): Promise<void> => {
  // This will be handled by the useUpdateThread hook in React components
  throw new Error("Use useUpdateThread hook instead of async updateThread");
};

export const deleteThread = async (id: string): Promise<void> => {
  // This will be handled by the useDeleteThread hook in React components
  throw new Error("Use useDeleteThread hook instead of async deleteThread");
};

export const deleteAllThreads = async (): Promise<void> => {
  // This will be handled by the useDeleteAllThreads hook in React components
  throw new Error("Use useDeleteAllThreads hook instead of async deleteAllThreads");
};

export const getMessagesByThreadId = async (threadId: string) => {
  // This will be handled by the useGetMessagesByThreadId hook in React components
  throw new Error("Use useGetMessagesByThreadId hook instead of async getMessagesByThreadId");
};

export const createMessage = async (threadId: string, message: UIMessage): Promise<void> => {
  // This will be handled by the useCreateMessage hook in React components
  throw new Error("Use useCreateMessage hook instead of async createMessage");
};

export const deleteTrailingMessages = async (threadId: string, createdAt: Date, gte = true): Promise<void> => {
  // This will be handled by the useDeleteTrailingMessages hook in React components
  throw new Error("Use useDeleteTrailingMessages hook instead of async deleteTrailingMessages");
};

export const createMessageSummary = async (threadId: string, messageId: string, content: string): Promise<void> => {
  // This will be handled by the useCreateMessageSummary hook in React components
  throw new Error("Use useCreateMessageSummary hook instead of async createMessageSummary");
};

export const getMessageSummaries = async (threadId: string) => {
  // This will be handled by the useGetMessageSummaries hook in React components
  throw new Error("Use useGetMessageSummaries hook instead of async getMessageSummaries");
}; 