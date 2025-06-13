"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { OpenAI } from "openai";
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
    console.log(`[openai.chat] Action started for model: ${model}.`);

    const aiModelName = model as AIModel;
    const modelConfig: ModelConfig = MODEL_CONFIGS[aiModelName];

    // Ensure we are using an OpenAI model for this test
    if (modelConfig.provider !== "openai") {
        const errorMsg = `This action is currently configured for OpenAI, but received model for provider: ${modelConfig.provider}`;
        console.error(`[openai.chat] ACTION FAILED: ${errorMsg}`);
        await ctx.runMutation(internal.messages.finalize, {
            messageId: assistantMessageId,
            content: `Configuration Error: ${errorMsg}`,
        });
        return null;
    }

    let apiKey = userApiKey;
    if (!apiKey) {
      apiKey = getApiKeyFromConvexEnv("openai"); // Specifically get the OpenAI key
    }

    if (!apiKey) {
      const errorMsg = "OpenAI API key is missing. Please add it to your Convex environment variables.";
      console.error(`[openai.chat] ACTION FAILED: ${errorMsg}`);
      await ctx.runMutation(internal.messages.finalize, {
        messageId: assistantMessageId,
        content: `Configuration Error: ${errorMsg}`,
      });
      return null;
    }

    const openai = new OpenAI({ apiKey });

    try {
      console.log(`[openai.chat] Creating stream with model: ${modelConfig.modelId}`);
      const stream = await openai.chat.completions.create({
        model: modelConfig.modelId, // Use the specific model ID, e.g., "gpt-4.1"
        stream: true,
        messages: messageHistory.map(({ content, role }) => ({
          role: role as "user" | "assistant",
          content,
        })),
      });

      let body = "";
      let chunkCount = 0;
      for await (const part of stream) {
        const delta = part.choices[0]?.delta?.content;
        if (delta) {
          body += delta;
          chunkCount++;
          // Update the message in the database with the new content
          await ctx.runMutation(internal.messages.update, {
            messageId: assistantMessageId,
            content: body,
          });
        }
      }

      console.log(`[openai.chat] Stream finished after ${chunkCount} chunks. Finalizing message.`);
      // Finalize the message with the complete body and mark it as complete
      await ctx.runMutation(internal.messages.finalize, {
        messageId: assistantMessageId,
        content: body,
      });

    } catch (e: any) {
      let errorMessage = "An unknown error occurred";
      if (e instanceof OpenAI.APIError) {
        // Handle specific OpenAI API errors (e.g., invalid key, rate limits)
        errorMessage = `OpenAI API Error: ${e.status} ${e.name} - ${e.message}`;
      } else {
        errorMessage = e.message || errorMessage;
      }
      
      console.error(`[openai.chat] ACTION FAILED: ${errorMessage}`, e);
      // Update the message in the UI with a helpful error
      await ctx.runMutation(internal.messages.finalize, {
        messageId: assistantMessageId,
        content: `Sorry, I ran into an error: ${errorMessage}`,
      });
    }
    
    return null;
  },
}); 