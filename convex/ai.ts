"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { CoreMessage } from "ai";

import { MODEL_CONFIGS, type AIModel, type ModelConfig } from "./models";
import { getApiKeyFromConvexEnv } from "./utils/apiKeys";

// Import the stream functions from our new providers directory
import * as openai from "./providers/openai";
import * as google from "./providers/google";
import * as anthropic from "./providers/anthropic";
import * as openrouter from "./providers/openrouter";

const providerStreamers = {
  openai: openai.stream,
  google: google.stream,
  anthropic: anthropic.stream,
  openrouter: openrouter.stream,
};

const messageValidator = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  threadId: v.id("threads"),
  role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("data")),
  content: v.string(),
  parts: v.optional(v.any()),
  isComplete: v.optional(v.boolean()),
  createdAt: v.number(),
});

type ChatParams = {
  messageHistory: Doc<"messages">[];
  assistantMessageId: Doc<"messages">["_id"];
  model: string;
  userApiKey?: string;
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

    try {
      // Use our new Google provider for title generation
      const stream = google.stream(googleApiKey, "gemini-2.0-flash", [ // Use a fast model
        {
          role: "system",
          content: `
            - You will generate a short title based on the first message a user begins a conversation with.
            - The title should be no more than 10 words.
            - Do not use quotes or colons.
            - Do not answer the user's question, only generate a title.
          `
        },
        {
          role: "user",
          content: args.prompt
        }
      ]);

      let title = "";
      for await (const chunk of stream) {
        title += chunk;
      }

      // Schedule mutations to update the database
      if (args.isTitle) {
        await ctx.scheduler.runAfter(
          0,
          internal.threads.internalUpdateTitle,
          { threadId: args.threadId, title: title.trim() },
        );
      }
      
      await ctx.scheduler.runAfter(
        0,
        internal.messages.internalCreateSummary,
        { threadId: args.threadId, messageId: args.messageId, content: title.trim() },
      );

      return { success: true, title: title.trim() };
    } catch (error: any) {
      console.error("Failed to generate title:", error);
      // Don't throw here, just log the error. The chat can continue without a title.
      return { success: false };
    }
  },
});

export const chat = internalAction({
  args: {
    messageHistory: v.array(messageValidator),
    assistantMessageId: v.id("messages"),
    model: v.string(),
    userApiKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { messageHistory, assistantMessageId, model, userApiKey }: ChatParams) => {
    console.log(`[ai.chat] Action started for model: ${model}.`);
    
    try {
      const aiModelName = model as AIModel;
      const modelConfig: ModelConfig = MODEL_CONFIGS[aiModelName];
      const provider = modelConfig.provider;

      let apiKey = userApiKey || getApiKeyFromConvexEnv(provider);
      if (!apiKey) throw new Error(`API key for ${provider} is required.`);

      const streamProvider = providerStreamers[provider];
      if (!streamProvider) throw new Error(`No streamer implemented for provider: ${provider}`);

      const messagesForSdk: CoreMessage[] = messageHistory.map(({ content, role }) => ({
        role: role as "user" | "assistant" | "system",
        content,
      }));
      
      const stream = streamProvider(apiKey, modelConfig.modelId, messagesForSdk);

      let body = "";
      for await (const textPart of stream) {
        body += textPart;
        await ctx.runMutation(internal.messages.update, {
          messageId: assistantMessageId,
          content: body,
        });
      }
      
      await ctx.runMutation(internal.messages.finalize, {
        messageId: assistantMessageId,
        content: body,
      });

    } catch (e: any) {
      const errorMessage = e.message || "An unknown error occurred";
      console.error(`[ai.chat] ACTION FAILED: ${errorMessage}`, e);
      await ctx.runMutation(internal.messages.finalize, {
        messageId: assistantMessageId,
        content: `Sorry, I ran into an error: ${errorMessage}`,
      });
    }

    return null;
  },
}); 