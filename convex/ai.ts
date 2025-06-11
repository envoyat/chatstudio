"use node"; // This must be at the top of the file to use Node.js runtime for @ai-sdk

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api"; // Import internal API for scheduling mutations
import { v } from "convex/values";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, generateText } from "ai";
import { MODEL_CONFIGS, type AIModel, type ModelConfig } from "./models";
import type { Message } from "ai";

// Helper to get API key from Convex environment variables.
// These environment variables must be set in your Convex dashboard or via `npx convex env set`.
const getApiKeyFromConvexEnv = (providerKey: string): string | undefined => {
  switch (providerKey) {
    case "google":
      return process.env.HOST_GOOGLE_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "openrouter":
      return process.env.OPENROUTER_API_KEY;
    default:
      return undefined;
  }
};

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
    let googleApiKey = args.userGoogleApiKey;
    if (!googleApiKey) {
      googleApiKey = getApiKeyFromConvexEnv("google");
    }

    if (!googleApiKey) {
      // Return an error if no Google API key is available
      throw new Error("Google API key is required to enable chat title generation.");
    }

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