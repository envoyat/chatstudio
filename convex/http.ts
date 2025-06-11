import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api"; // Import the generated API to call internal actions

const http = httpRouter();

// Define the POST route for /api/chat
http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Parse the request body, expecting model, messages, and userApiKey
    const { messages, model, userApiKey } = await request.json();

    try {
      // Call the internal AI action to stream the chat response.
      // `ctx.runAction` streams the response directly.
      const responseStream = await ctx.runAction(internal.ai.streamChat, {
        messages,
        model,
        userApiKey, // Pass user's API key to the action
      });

      // Set CORS and streaming headers for the response
      const headers = new Headers();
      headers.set("Access-Control-Allow-Origin", process.env.CLIENT_ORIGIN || "*");
      headers.set("Vary", "Origin");
      headers.set("Content-Type", "text/event-stream"); // Essential for streaming text
      headers.set("Cache-Control", "no-cache");
      headers.set("Connection", "keep-alive");

      // Return a standard Response object with the stream body
      return new Response(responseStream.body, {
        status: 200,
        headers: headers,
      });

    } catch (error: any) {
      console.error("HTTP chat action error:", error);
      // Return a JSON error response with appropriate CORS headers
      return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
        status: 500,
        headers: new Headers({
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN || "*",
          "Vary": "Origin",
        }),
      });
    }
  }),
});

// Define the OPTIONS route for /api/chat (CORS pre-flight)
http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    // Check if the necessary headers for a pre-flight request are present
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      // Respond with CORS headers allowing the actual request
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN || "*",
          "Access-Control-Allow-Methods": "POST",
          // Allow custom API key headers for various providers
          "Access-Control-Allow-Headers": "Content-Type, X-Google-API-Key, X-Anthropic-API-Key, X-OpenAI-API-Key, X-OpenRouter-API-Key",
          "Access-Control-Max-Age": "86400", // Cache pre-flight response for 24 hours
        }),
      });
    } else {
      // If not a valid pre-flight, return an empty response
      return new Response();
    }
  }),
});

// Convex expects the router to be the default export of `convex/http.js`.
export default http; 