import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";

interface SessionState {
  sessionId: string | null;
  getOrCreateSessionId: () => string;
  clearSessionId: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      getOrCreateSessionId: () => {
        let { sessionId } = get();
        if (!sessionId) {
          sessionId = uuidv4();
          set({ sessionId });
        }
        return sessionId;
      },
      clearSessionId: () => set({ sessionId: null }),
    }),
    {
      name: "chat-guest-session",
    },
  ),
); 