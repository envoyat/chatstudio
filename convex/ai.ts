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

// --- streamChat Internal Action ---
// This action streams chat responses from AI providers.
export const streamChat = internalAction({
  args: {
    messages: v.array(v.any()), // AI SDK's Message type
    model: v.string(), // AIModel
    userApiKey: v.optional(v.string()), // User's API key passed from client
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const aiModelName = args.model as AIModel;
    const modelConfig: ModelConfig = MODEL_CONFIGS[aiModelName];

    let apiKey = args.userApiKey;

    // If no user key, try to use host key from Convex environment variables
    if (!apiKey) {
      apiKey = getApiKeyFromConvexEnv(modelConfig.provider);
    }

    if (!apiKey) {
      throw new Error(`API key is required for ${modelConfig.provider}. Please set it or provide user key.`);
    }

    let aiClientModel;
    switch (modelConfig.provider) {
      case "google":
        const google = createGoogleGenerativeAI({ apiKey });
        aiClientModel = google(modelConfig.modelId);
        break;
      case "openai":
        const openai = createOpenAI({ apiKey });
        aiClientModel = openai(modelConfig.modelId);
        break;
      case "openrouter":
        const openrouter = createOpenRouter({ apiKey });
        aiClientModel = openrouter(modelConfig.modelId);
        break;
      default:
        throw new Error("Unsupported model provider");
    }

    const result = await streamText({
      model: aiClientModel,
      messages: args.messages as Message[], // Cast back to Message[] for AI SDK
      system: `
        You are Chat Studio, a knowledgeable AI companion designed to assist users with various questions and tasks.
        
        Your core principles:
        - Provide accurate, helpful responses tailored to each user's needs
        - Maintain a friendly, professional demeanor throughout conversations
        - Foster engaging dialogue while staying focused on being useful
        
        Mathematical Expression Guidelines:
        When working with mathematical content, format expressions using LaTeX notation:
        
        For inline mathematics: Use single dollar signs to wrap expressions like $x^2 + y^2 = z^2$
        For block-level mathematics: Use double dollar signs and place on separate lines
        
        Keep math formatting consistent - avoid mixing different delimiter styles within the same response.
        
        Mathematical formatting examples:
        • Inline usage: "The formula $a^2 + b^2 = c^2$ represents the Pythagorean theorem"
        • Block format:
        $$\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$
      `,
      // `smoothStream` should be handled client-side if desired,
      // as `streamText` here directly returns a stream.
    });

    // streamText returns a stream, so we return its body as a Response.
    // Convex's HTTP action wrapper will handle streaming this to the client.
    return result.toDataStreamResponse();
  },
});


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