import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

const SESSION_KEY = "chat-session-id";

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      let storedId = localStorage.getItem(SESSION_KEY);
      if (!storedId) {
        storedId = uuidv4();
        localStorage.setItem(SESSION_KEY, storedId);
      }
      setSessionId(storedId);
    } catch (error) {
      console.error("Could not access localStorage:", error);
      // Fallback for environments where localStorage is not available
      if (!sessionId) {
        setSessionId(uuidv4());
      }
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  return { sessionId, isSessionLoading: isLoading };
} 