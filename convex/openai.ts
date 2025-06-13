"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { MODEL_CONFIGS, type AIModel, type ModelConfig } from "./models";
import { getApiKeyFromConvexEnv } from "./utils/apiKeys";

type ChatParams = {
  messageHistory: Doc<"messages">[];
  assistantMessageId: Doc<"messages">["_id"];
  model: string;
  userApiKey?: string;
};

export const chat = internalAction({
  args: {
    messageHistory: v.array(v.any()),
    assistantMessageId: v.id("messages"),
    model: v.string(),
    userApiKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { messageHistory, assistantMessageId, model, userApiKey }: ChatParams) => {
    try {
      const aiModelName = model as AIModel;
      const modelConfig: ModelConfig = MODEL_CONFIGS[aiModelName];

      let apiKey = userApiKey;
      if (!apiKey) {
        apiKey = getApiKeyFromConvexEnv(modelConfig.provider);
      }

      if (!apiKey) {
        throw new Error(`API key for ${modelConfig.provider} is required.`);
      }

      let aiClientModel;
      switch (modelConfig.provider) {
        case "google":
          const google = createGoogleGenerativeAI({ apiKey });
          aiClientModel = google(modelConfig.modelId);
          break;
        case "anthropic":
          const anthropic = createAnthropic({ apiKey });
          aiClientModel = anthropic(modelConfig.modelId);
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
          throw new Error(`Unsupported model provider: ${modelConfig.provider}`);
      }

      const { textStream } = await streamText({
        model: aiClientModel,
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
        messages: messageHistory.map(({ content, role }) => ({
          role: role as "user" | "assistant",
          content,
        })),
      });

      let body = "";
      for await (const textPart of textStream) {
        body += textPart;
        await ctx.runMutation(internal.messages.update, {
          messageId: assistantMessageId,
          content: body,
        });
      }

      // Finalize the message with the complete body and mark it as complete.
      await ctx.runMutation(internal.messages.finalize, {
        messageId: assistantMessageId,
        content: body,
      });
    } catch (e: any) {
      const errorMessage = e.message || "An unknown error occurred";
      console.error(`AI chat action failed: ${errorMessage}`);
      await ctx.runMutation(internal.messages.finalize, {
        messageId: assistantMessageId,
        content: `Sorry, I ran into an error: ${errorMessage}`,
      });
    }

    return null;
  },
}); 