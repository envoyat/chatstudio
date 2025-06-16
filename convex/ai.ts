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
  _id: v.id("messages"),
  _creationTime: v.number(),
  conversationId: v.id("conversations"),
  role: v.union(v.literal(MESSAGE_ROLES.USER), v.literal(MESSAGE_ROLES.ASSISTANT), v.literal(MESSAGE_ROLES.SYSTEM), v.literal(MESSAGE_ROLES.DATA)),
  content: v.string(),
  parts: v.optional(v.any()),
  isComplete: v.optional(v.boolean()),
  createdAt: v.number(),
  toolCalls: v.optional(v.any()),
  toolOutputs: v.optional(v.any()),
});

type ChatParams = {
  messageHistory: Doc<"messages">[];
  assistantMessageId: Doc<"messages">["_id"];
  model: string;
  conversationId: Doc<"conversations">["_id"];
  userApiKey?: string;
  isWebSearchEnabled?: boolean;
};

// System prompt function that includes current date and web search instructions
function createSystemPrompt(isWebSearchEnabled: boolean = false): CoreMessage {
  const currentDate = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
  
  console.log(`[createSystemPrompt] Generated date: ${currentDate}`);

  let systemContent = `Current Date: ${currentDate}

You are a helpful AI assistant. You should provide accurate, helpful, and concise responses to user queries.

Key Guidelines:
- Always strive to be helpful, accurate, and informative
- If you're unsure about something, acknowledge your uncertainty
- Use clear, well-structured responses
- Maintain a friendly and professional tone`;

  if (isWebSearchEnabled) {
    systemContent += `

Web Search Instructions:
- You have access to a web search tool that can help you find current information
- Use web search when users ask about:
  * Recent events, news, or current affairs
  * Real-time data (stock prices, weather, sports scores)
  * Specific facts that may have changed recently
  * Information that requires up-to-date sources
- When using web search, be specific and concise with your search queries
- Always cite the source of web search information when presenting results
- If web search returns no useful results, inform the user clearly`;
  }

  return {
    role: MESSAGE_ROLES.SYSTEM as "system",
    content: systemContent
  };
}

// --- generateTitle Internal Action ---
// This action generates a title/summary for a message and schedules database updates.
export const generateTitle = internalAction({
  args: {
    prompt: v.string(),
    isTitle: v.optional(v.boolean()),
    messageId: v.id("messages"),
    conversationId: v.id("conversations"),
    userGoogleApiKey: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    title: v.optional(v.string()),
  }),
  handler: async (ctx, { prompt, isTitle, conversationId, messageId, userGoogleApiKey }) => {
    let googleApiKey = userGoogleApiKey || getApiKeyFromConvexEnv("google");
    
    if (!googleApiKey) {
      const errorMessage = userGoogleApiKey 
        ? "Both user and host Google API keys are missing. Please set HOST_GOOGLE_API_KEY in Convex environment variables."
        : "No Google API key available. Either provide a user API key or set HOST_GOOGLE_API_KEY in Convex environment variables.";
      
      console.error(`Title generation failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    try {
      const google = createGoogleGenerativeAI({ apiKey: googleApiKey });
      const result = await streamText({
        model: google("gemini-2.0-flash"),
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
                content: prompt
            }
        ]});

      let title = "";
      for await (const chunk of result.textStream) {
        title += chunk;
      }

      if (isTitle) {
        await ctx.scheduler.runAfter(
          0,
          internal.conversations.updateTitle,
          { conversationId: conversationId, title: title.trim() },
        );
      }
      
      await ctx.scheduler.runAfter(
        0,
        internal.messages.internalCreateSummary,
        { conversationId, messageId, content: title.trim() },
      );

      return { success: true, title: title.trim() };
    } catch (error: any) {
      console.error("Failed to generate title:", error);
      return { success: false };
    }
  },
});

export const chat = internalAction({
  args: {
    messageHistory: v.array(messageValidator),
    assistantMessageId: v.id("messages"),
    model: v.string(),
    conversationId: v.id("conversations"),
    userApiKey: v.optional(v.string()),
    isWebSearchEnabled: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { messageHistory, assistantMessageId, model, conversationId, userApiKey, isWebSearchEnabled }: ChatParams) => {
    try {
      const aiModelName = model as AIModel;
      const modelConfig: ModelConfig = MODEL_CONFIGS[aiModelName as keyof typeof MODEL_CONFIGS];
      const provider = modelConfig.provider;

      let providerInstance;
      if (provider === 'openai') {
          providerInstance = createOpenAI({
              apiKey: userApiKey,
          });
      } else if (provider === 'google') { 
          providerInstance = createGoogleGenerativeAI({
              apiKey: userApiKey,
          });
      } else if (provider === 'anthropic') {
          providerInstance = createAnthropic({
              apiKey: userApiKey,
          });
      } else if (provider === 'openrouter') {
          providerInstance = createOpenAI({
              apiKey: userApiKey,
              baseURL: "https://openrouter.ai/api/v1",
          });
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      const systemPrompt = createSystemPrompt(isWebSearchEnabled);
      
      // Filter out the last message if it's an empty assistant placeholder, which Anthropic doesn't allow.
      const filteredHistory = messageHistory.filter(
        (message, index) =>
          !(
            index === messageHistory.length - 1 &&
            message.role === MESSAGE_ROLES.ASSISTANT &&
            message.content === ""
          )
      );

      const messagesForSdk: CoreMessage[] = [
        systemPrompt,
        ...filteredHistory.map(({ content, role }) => ({
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

      let parts: (
        | { type: 'text'; text: string }
        | { type: 'tool-call'; id: string; name: string; args: any }
        | { type: 'tool-result'; toolCallId: string; result: any }
      )[] = [];
      
      const updateMessage = async () => {
        const content = parts
          .filter((part) => part.type === 'text')
          .map((part) => (part as { type: 'text'; text: string }).text)
          .join('');

        // Separate tool calls and results for structured storage
        const toolCalls = parts.filter(part => part.type === 'tool-call');
        const toolOutputs = parts.filter(part => part.type === 'tool-result');

        await ctx.runMutation(internal.messages.update, {
          messageId: assistantMessageId,
          content,
          parts,
          toolCalls,
          toolOutputs,
        });
      };

      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta': {
            const lastPart = parts[parts.length - 1];
            if (lastPart?.type === 'text') {
              lastPart.text += part.textDelta;
            } else {
              parts.push({ type: 'text', text: part.textDelta });
            }
            await updateMessage();
            break;
          }
          case 'tool-call': {
            parts.push({
              type: 'tool-call',
              id: part.toolCallId,
              name: part.toolName,
              args: part.args,
            });
            await updateMessage();
            break;
          }
          case 'tool-result': {
            parts.push({
              type: 'tool-result',
              toolCallId: part.toolCallId,
              result: part.result,
            });
            await updateMessage();
            console.log(`[ai.chat] Tool result for ${part.toolName}:`, part.result);
            break;
          }
          case 'error': {
            console.error('[ai.chat] Error from AI stream:', part.error);
            throw part.error;
          }
        }
      }

      const finalContent = parts
        .filter((part) => part.type === 'text')
        .map((part) => (part as { type: 'text'; text: string }).text)
        .join('');

      await ctx.runMutation(internal.messages.finalise, {
        messageId: assistantMessageId,
        content: finalContent,
      });
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