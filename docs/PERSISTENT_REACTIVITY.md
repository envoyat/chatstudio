# Architecture: The Persistent Reactivity Pattern

This document outlines the core architectural pattern used in Chat Studio for handling real-time AI interactions. We call this the "Persistent Reactivity" pattern, which leverages the unique capabilities of the Convex backend platform to create a robust, resilient, and multi-device chat experience.

This pattern intentionally moves away from traditional end-to-end HTTP streaming from the client in favor of a database-centric approach.

## The Core Idea

The fundamental principle is to **decouple the client's request lifecycle from the server's AI generation lifecycle**. Instead of the client waiting for a streaming HTTP response, it fires a mutation to the backend and immediately starts listening for changes in the database. The server, in the background, handles the AI stream and continuously updates the database.

This creates a "single source of truth" (the Convex database) that the UI reactively mirrors.

## The Flow of a Message

Here is the step-by-step flow when a user sends a message to the AI:


*(This diagram illustrates the pattern using the article's terminology. Your implementation matches this flow.)*

1.  **Client: Fire-and-Forget Mutation (`ChatInput.tsx`)**
    *   The user types a message and clicks "Send".
    *   The frontend **does not** make a direct HTTP streaming request.
    *   Instead, it calls a Convex mutation (`messages.send`) with the user's content and the selected AI model.
    *   This is a "fire-and-forget" operation from the client's perspective. The client's job is done after this single, quick call.

2.  **Backend Mutation: Orchestration (`convex/messages.ts`)**
    *   The `messages.send` mutation is executed on the Convex backend. It performs three critical tasks in a single atomic transaction:
        a. **Inserts the User's Message:** The user's message is saved to the `messages` table with `isComplete: true`.
        b. **Creates an AI Placeholder:** A new row is immediately inserted for the assistant's upcoming response. This message has an empty `content` and is marked with `isComplete: false`.
        c. **Schedules a Background Action:** It schedules an `internalAction` (`ai.chat`) to run immediately in the background, passing it the conversation history and the ID of the placeholder message.

3.  **Client: Reactive Update (`Chat.tsx`)**
    *   Because the client is using the `useQuery(api.messages.list, ...)` hook, it is subscribed to any changes in the `messages` table.
    *   The instant the `messages.send` mutation completes, the client's query re-runs, and the UI receives two new messages: the user's message and the empty AI placeholder.
    *   The UI sees the placeholder with `isComplete: false` and uses this state to render a loading indicator (e.g., a typing animation).

4.  **Backend Action: AI Streaming (`convex/ai.ts`)**
    *   The scheduled `ai.chat` action begins executing in a Node.js environment.
    *   It determines which AI provider to use (OpenAI, Google, Anthropic) based on the model selected by the user.
    *   It calls the chosen provider's streaming API directly.
    *   It enters a loop (`for await...of stream`). **This is the key part.**

5.  **Backend Loop: Progressive Database Updates**
    *   Inside the loop, for every chunk of text received from the AI provider, the action does not send it back to the client.
    *   Instead, it calls an `internalMutation` (`messages.update`), appending the new text chunk to the `content` field of the AI's placeholder message in the database.

6.  **Client: Real-Time UI Streaming**
    *   Each time the `messages.update` mutation modifies the AI message in the database, Convex's reactive infrastructure detects the change.
    *   The `useQuery` hook on the client automatically re-fetches the updated data.
    *   The React component re-renders with the slightly longer `content`, making the text appear to stream into the UI.

7.  **Backend: Finalization**
    *   Once the AI provider's stream is complete, the `ai.chat` action makes one final mutation call to `messages.finalise`.
    *   This final mutation updates the message with the full content and, crucially, sets `isComplete: true`.

8.  **Client: Final State**
    *   The client receives the final update from the `finalise` mutation.
    *   Seeing `isComplete: true`, it removes the loading indicator and considers the AI's turn finished. The sidebar spinner disappears.

## Why This Pattern is Powerful

1.  **Persistence & Resiliency:** If the user closes their browser, loses their network connection, or switches devices, it doesn't matter. The AI generation continues on the server. When they reopen the app, `useQuery` fetches the latest state from the database, whether it's mid-stream or already complete.

2.  **Multi-Device Sync:** If the user has the same chat open on their phone and laptop, they will see the AI response stream in on **both devices simultaneously** because both are subscribed to the same database query.

3.  **Simplified Client Logic:** The frontend becomes much "dumber" in a good way. It doesn't need to manage complex streaming state, handle broken connections, or parse server-sent events. Its only job is to send a mutation and render the data it receives from `useQuery`.

4.  **Decoupled & Scalable Backend:** The backend action is a self-contained, serverless function. It can run for a long time (up to 5 minutes on Convex) without being tied to a client's HTTP connection. This is more scalable and robust than holding a WebSocket or HTTP stream open.

5.  **Real-Time for Everyone:** This pattern inherently enables "spectator" or "multiplayer" chat experiences. Any user subscribed to the query will see the updates in real time.

In conclusion, the Persistent Reactivity pattern trades the directness of end-to-end streaming for a vastly more robust, persistent, and real-time architecture by using the database as the central, reactive intermediary.