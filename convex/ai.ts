"use node"; // This must be at the top of the file to use Node.js runtime for @ai-sdk

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api"; // Import internal API for scheduling mutations
import { v } from "convex/values";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { getApiKeyFromConvexEnv } from "./utils/apiKeys";

// --- generateTitle Internal Action ---
// This action generates a title/summary for a message and schedules database updates.
export const generateTitle = internalAction({
  args: {
    prompt: v.string(),
    isTitle: v.optional(v.boolean()),
    messageId: v.id("messages"), // Convex ID for the message
    threadId: v.id("threads"),   // Convex ID for the thread
    userGoogleApiKey: v.optional(v.string()), // User's Google API key passed from client
  },
  returns: v.object({
    success: v.boolean(),
    title: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Try user's API key first, then fallback to host API key
    let googleApiKey = args.userGoogleApiKey;
    let keySource = "user";
    
    if (!googleApiKey) {
      googleApiKey = getApiKeyFromConvexEnv("google");
      keySource = "host";
    }

    if (!googleApiKey) {
      // Provide a more specific error message
      const errorMessage = args.userGoogleApiKey 
        ? "Both user and host Google API keys are missing. Please set HOST_GOOGLE_API_KEY in Convex environment variables."
        : "No Google API key available. Either provide a user API key or set HOST_GOOGLE_API_KEY in Convex environment variables.";
      
      console.error(`Title generation failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    console.log(`Using ${keySource} Google API key for title generation`);

    const google = createGoogleGenerativeAI({ apiKey: googleApiKey });

    try {
      const { text: title } = await generateText({
        model: google("gemini-2.0-flash-exp"), // Use a fast model for title generation
        system: `
          - you will generate a short title based on the first message a user begins a conversation with
          - ensure it is not more than 80 characters long
          - the title should be a summary of the user's message
          - you should NOT answer the user's message, you should only generate a summary/title
          - do not use quotes or colons
        `,
        prompt: args.prompt,
      });

      // Schedule mutations to update the database
      if (args.isTitle) {
        await ctx.scheduler.runAfter(
          0,
          internal.threads.internalUpdateTitle, // Call internal mutation
          { threadId: args.threadId, title: title },
        );
      }
      
      await ctx.scheduler.runAfter(
        0,
        internal.messages.internalCreateSummary, // Call internal mutation
        { threadId: args.threadId, messageId: args.messageId, content: title },
      );

      // Return a success response (optional, but good practice for actions)
      return { success: true, title };
    } catch (error: any) {
      console.error("Failed to generate title:", error);
      throw new Error(`Failed to generate title: ${error.message || 'Unknown error'}`);
    }
  },
}); 