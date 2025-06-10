import { useEffect } from "react";
import { useConvexAuth } from "convex/react";
import { anonymousStorage } from "../storage/anonymous-storage";
import { useCreateThread, useCreateMessage } from "../storage/convex-queries";

export const useDataMigration = () => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const createThread = useCreateThread();
  const createMessage = useCreateMessage();

  useEffect(() => {
    const migrateData = async () => {
      if (!isAuthenticated || isLoading) return;

      const migrationKey = "chatstudio_migration_completed";
      if (localStorage.getItem(migrationKey)) return;

      try {
        const { threads, messages } = anonymousStorage.getDataForMigration();
        
        if (threads.length === 0) {
          localStorage.setItem(migrationKey, "true");
          return;
        }

        console.log(`Migrating ${threads.length} threads and ${messages.length} messages...`);

        // Create threads first
        const threadIdMap = new Map<string, string>();
        for (const thread of threads) {
          try {
            const convexThreadId = await createThread({
              id: thread.id,
              title: thread.title,
            });
            threadIdMap.set(thread.id, convexThreadId);
          } catch (error) {
            console.error("Failed to migrate thread:", thread.id, error);
          }
        }

        // Then create messages
        for (const message of messages) {
          const convexThreadId = threadIdMap.get(message.threadId);
          if (convexThreadId) {
            try {
              await createMessage({
                threadId: convexThreadId,
                messageId: message.id,
                parts: message.parts,
                content: message.content,
                role: message.role,
                createdAt: message.createdAt,
              });
            } catch (error) {
              console.error("Failed to migrate message:", message.id, error);
            }
          }
        }

        // Clear anonymous storage after successful migration
        anonymousStorage.clearAll();
        localStorage.setItem(migrationKey, "true");
        console.log("Data migration completed successfully");
      } catch (error) {
        console.error("Data migration failed:", error);
      }
    };

    migrateData();
  }, [isAuthenticated, isLoading, createThread, createMessage]);
}; 