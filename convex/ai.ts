"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type CoreMessage, streamText, tool } from "ai";
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';

import { MODEL_CONFIGS, type AIModel, type ModelConfig } from "./models";
import { getApiKeyFromConvexEnv } from "./utils/apiKeys";
import { MESSAGE_ROLES } from "./constants";

const messageValidator = v.object({
  role: v.string(),
  content: v.string(),
});

type ChatMessage = {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
};

type ChatParams = {
  messageHistory: ChatMessage[];
  assistantMessageId: Doc<"messages">["_id"];
  model: string;
  userApiKey?: string;
  isWebSearchEnabled?: boolean;
};

function createSystemPrompt(isWebSearchEnabled?: boolean): CoreMessage {
  const currentDate = new Date().toISOString().split("T")[0];
  const webSearchPrompt = isWebSearchEnabled
    ? `
- For questions that require up-to-date information, you can use the \`web_search\` tool.
- Today's date is ${currentDate}.
- Always cite your sources when using search results.`
    : "";

  return {
    role: "system",
    content: `You are a helpful AI assistant.
- You must always be polite and professional.
- Your responses must be in Markdown format.
- You can use tables, lists, and other formatting to make your responses easier to read.${webSearchPrompt}`,
  };
}

export const generateTitle = internalAction({
  args: {
    prompt: v.string(),
    conversationId: v.id("conversations"),
    isTitle: v.boolean()
  },
  handler: async (ctx, args) => {
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      console.warn("[ai.generateTitle] GOOGLE_API_KEY is not set, skipping title generation.");
      return;
    }

    try {
      const google = createGoogleGenerativeAI({ apiKey: googleApiKey });
      const result = await streamText({
        model: google("gemini-pro"),
        messages: [
            {
                role: MESSAGE_ROLES.SYSTEM,
                content: `
                    - You will generate a short title based on the first message a user begins a conversation with.
                    - The title should be no more than 10 words.
                    - Do not use quotes or colons.
                    - Do not answer the user's question, only generate a title.
                `
            },
            {
                role: MESSAGE_ROLES.USER,
                content: args.prompt
            }
        ]});

      let title = "";
      for await (const chunk of result.textStream) {
        title += chunk;
      }

      console.log(`[ai.generateTitle] Generated title: ${title}`);

      if (args.isTitle) {
        await ctx.runMutation(internal.conversations.updateTitle, {
          conversationId: args.conversationId,
          title: title,
        });
      }
    } catch (error) {
      console.error("[ai.generateTitle] Failed to generate title:", error);
    }
  },
});

export const chat = internalAction({
  args: {
    messageHistory: v.array(messageValidator),
    assistantMessageId: v.id("messages"),
    model: v.string(),
    userApiKey: v.optional(v.string()),
    isWebSearchEnabled: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { messageHistory, assistantMessageId, model, userApiKey, isWebSearchEnabled }: ChatParams) => {
    try {
      const aiModelName = model as AIModel;
      const modelConfig: ModelConfig = MODEL_CONFIGS[aiModelName];
      const provider = modelConfig.provider;

      if (provider === 'openai' || provider === 'google' || provider === 'anthropic' || provider === 'openrouter') {
        let providerInstance;
        if (provider === 'openai') {
            providerInstance = createOpenAI({
                apiKey: userApiKey, // Will use process.env.OPENAI_API_KEY if undefined
            });
        } else if (provider === 'google') { 
            providerInstance = createGoogleGenerativeAI({
                apiKey: userApiKey, // Will use process.env.GOOGLE_GENERATIVE_AI_API_KEY if undefined
            });
        } else if (provider === 'anthropic') {
            providerInstance = createAnthropic({
                apiKey: userApiKey, // Will use process.env.ANTHROPIC_API_KEY if undefined
            });
        } else { // provider === 'openrouter'
            providerInstance = createOpenAI({
                apiKey: userApiKey, // Will use process.env.OPENROUTER_API_KEY if undefined
                baseURL: "https://openrouter.ai/api/v1",
            });
        }

        const systemPrompt = createSystemPrompt(isWebSearchEnabled);
        const messagesForSdk: CoreMessage[] = [
          systemPrompt,
          ...messageHistory.map(({ content, role }) => ({
            role: role as "user" | "assistant" | "system",
            content,
          })),
        ];

        const tools = {
          web_search: tool({
            description: "Search the web for current information. Use this tool when you need up-to-date information about recent events, current affairs, real-time data (stock prices, weather, sports scores), or specific facts that may have changed recently. Always provide clear citations when using search results.",
            parameters: z.object({
              query: z.string().describe("The search query to use. Be specific and concise. Focus on key terms relevant to the user's question."),
            }),
            execute: async ({ query }) => {
              return await ctx.runAction(internal.tools.webSearch.run, { query });
            }
          })
        };

        const result = await streamText({
          model: providerInstance(modelConfig.modelId as any),
          messages: messagesForSdk,
          tools: isWebSearchEnabled ? tools : undefined,
          toolChoice: isWebSearchEnabled ? 'auto' : undefined,
          maxSteps: 5,
        });

        let body = ""; 
        const currentToolCalls: any[] = [];

        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'text-delta': {
              body += part.textDelta;
              await ctx.runMutation(internal.messages.update, {
                messageId: assistantMessageId,
                content: body,
                toolCalls: currentToolCalls,
              });
              break;
            }
            case 'tool-call': {
              currentToolCalls.push({
                id: part.toolCallId, 
                name: part.toolName,
                args: JSON.stringify(part.args),
              });
              await ctx.runMutation(internal.messages.update, {
                messageId: assistantMessageId,
                content: body,
                toolCalls: currentToolCalls,
              });
              break;
            }
            case 'tool-result': {
              console.log(`[ai.chat] Tool result for ${part.toolName}:`, part.result);
              // We don't need to persist tool results to the DB for the current UI
              break;
            }
            case 'error': {
              console.error('[ai.chat] Error from AI stream:', part.error);
              throw part.error;
            }
          }
        }
        
        await ctx.runMutation(internal.messages.finalise, {
          messageId: assistantMessageId,
          content: body,
        });
      }
    } catch (e: any) {
      const errorMessage = e.message || "An unknown error occurred";
      console.error(`[ai.chat] ACTION FAILED: ${errorMessage}`, e);
      await ctx.runMutation(internal.messages.finalise, {
        messageId: assistantMessageId,
        content: `Sorry, I ran into an error: ${errorMessage}`,
      });
    }

    return null;
  },
}); 