"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { streamText, CoreMessage } from "ai"; // Import CoreMessage for type safety
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { MODEL_CONFIGS, type AIModel, type ModelConfig } from "./models";
import { getApiKeyFromConvexEnv } from "./utils/apiKeys";

// Define a precise validator for the message objects.
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

export const chat = internalAction({
  args: {
    messageHistory: v.array(messageValidator),
    assistantMessageId: v.id("messages"),
    model: v.string(),
    userApiKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { messageHistory, assistantMessageId, model, userApiKey }: ChatParams) => {
    console.log(`[openai.chat] Action started for assistant message ID: ${assistantMessageId}. Model: ${model}.`);
    
    try {
      const aiModelName = model as AIModel;
      const modelConfig: ModelConfig = MODEL_CONFIGS[aiModelName];

      let apiKey = userApiKey;
      let keySource = "user";

      if (!apiKey) {
        apiKey = getApiKeyFromConvexEnv(modelConfig.provider);
        keySource = "host";
      }
      
      if (apiKey) {
        console.log(`[openai.chat] Using API key from source: ${keySource} for provider ${modelConfig.provider}.`);
      } else {
        console.error(`[openai.chat] API key for provider '${modelConfig.provider}' is MISSING.`);
        throw new Error(`API key for ${modelConfig.provider} is required.`);
      }

      let aiClientModel;
      const commonClientOptions = { 
        apiKey,
        // Adding explicit headers is a good practice for debugging network issues in serverless envs
        headers: { 'Content-Type': 'application/json' }
      };

      switch (modelConfig.provider) {
        case "google":
          const google = createGoogleGenerativeAI(commonClientOptions);
          aiClientModel = google(modelConfig.modelId);
          break;
        case "anthropic":
          const anthropic = createAnthropic(commonClientOptions);
          aiClientModel = anthropic(modelConfig.modelId);
          break;
        case "openai":
          const openai = createOpenAI(commonClientOptions);
          aiClientModel = openai(modelConfig.modelId);
          break;
        case "openrouter":
          const openrouter = createOpenRouter(commonClientOptions);
          aiClientModel = openrouter(modelConfig.modelId);
          break;
        default:
          throw new Error(`Unsupported model provider: ${modelConfig.provider}`);
      }

      // Prepare messages with explicit type casting for the SDK
      const messagesForSdk: CoreMessage[] = messageHistory.map(({ content, role }) => ({
        role: role as "user" | "assistant",
        content,
      }));

      console.log("[openai.chat] Calling 'streamText' to AI provider with configured client.");
      
      const { textStream } = await streamText({
        model: aiClientModel,
        system: `You are Chat Studio, a knowledgeable AI companion.`, // Simplified system prompt for testing
        messages: messagesForSdk,
      });

      let body = "";
      let chunkCount = 0;
      for await (const textPart of textStream) {
        body += textPart;
        chunkCount++;
        await ctx.runMutation(internal.messages.update, {
          messageId: assistantMessageId,
          content: body,
        });
      }

      if (chunkCount === 0) {
        console.warn("[openai.chat] Stream finished with 0 chunks. The AI provider may have returned an empty response or there could be a silent error.");
        // We still finalize to prevent the UI from loading forever.
      } else {
        console.log(`[openai.chat] Stream finished after ${chunkCount} chunks. Finalizing message.`);
      }
      
      await ctx.runMutation(internal.messages.finalize, {
        messageId: assistantMessageId,
        content: body,
      });

    } catch (e: any) {
      const errorMessage = e.message || "An unknown error occurred";
      console.error(`[openai.chat] ACTION FAILED: ${errorMessage}`, e);
      await ctx.runMutation(internal.messages.finalize, {
        messageId: assistantMessageId,
        content: `Sorry, I ran into an error: ${errorMessage}`,
      });
    }

    return null;
  },
}); 