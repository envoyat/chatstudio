"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { CoreMessage } from "ai";

import { MODEL_CONFIGS, type AIModel, type ModelConfig } from "./models";
import { getApiKeyFromConvexEnv } from "./utils/apiKeys";
import { MESSAGE_ROLES } from "./constants";
import { ToolCallingProvider, getAvailableTools } from "./tools";

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
      const errorMessage = args.userGoogleApiKey 
        ? "Both user and host Google API keys are missing. Please set HOST_GOOGLE_API_KEY in Convex environment variables."
        : "No Google API key available. Either provide a user API key or set HOST_GOOGLE_API_KEY in Convex environment variables.";
      
      console.error(`Title generation failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    try {
      const stream = google.stream(googleApiKey, "gemini-2.0-flash", [
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
      ]);

      let title = "";
      for await (const chunk of stream) {
        title += chunk;
      }

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
    isWebSearchEnabled: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { messageHistory, assistantMessageId, model, userApiKey, isWebSearchEnabled }: ChatParams) => {
    try {
      const aiModelName = model as AIModel;
      const modelConfig: ModelConfig = MODEL_CONFIGS[aiModelName];
      const provider = modelConfig.provider;

      let apiKey = userApiKey || getApiKeyFromConvexEnv(provider);
      if (!apiKey) throw new Error(`API key for ${provider} is required.`);
      
      const tools = getAvailableTools(isWebSearchEnabled);
      
      // Create system prompt and prepare messages
      const systemPrompt = createSystemPrompt(isWebSearchEnabled);
      console.log(`[ai.chat] System prompt created: ${typeof systemPrompt.content === 'string' ? systemPrompt.content.substring(0, 100) + '...' : 'Non-string content'}`);
      
      // Use the new tool calling abstraction if tools are enabled
      if (tools.length > 0) {
        const toolProvider = new ToolCallingProvider(provider, apiKey, modelConfig.modelId);
        
        const messagesForSdk: CoreMessage[] = [
          systemPrompt,
          ...messageHistory.map(({ content, role }) => ({
            role: role as "user" | "assistant" | "system",
            content,
          }))
        ];
        
        console.log(`[ai.chat] Total messages for SDK: ${messagesForSdk.length}, first message role: ${messagesForSdk[0]?.role}`);

        // Stream with tools - handle proper conversation flow
        let initialMessageContent = "";
        let finalMessageContent = "";
        let toolCalls: any[] = [];
        let isAfterToolCall = false;
        
        for await (const chunk of toolProvider.streamWithTools(
          messagesForSdk,
          tools,
          async (toolCall) => {
            if (toolCall.name === 'web_search') {
              const searchResult = await ctx.runAction(internal.tools.webSearch.run, { 
                query: toolCall.args.query 
              });
              return searchResult;
            }
            return "Tool not found";
          }
        )) {
          if (chunk.type === "text") {
            if (!isAfterToolCall) {
              // This is the initial message before tool calls
              initialMessageContent += chunk.content;
              await ctx.runMutation(internal.messages.update, {
                messageId: assistantMessageId,
                content: initialMessageContent,
              });
            } else {
              // This is the final response after tool calls
              finalMessageContent += chunk.content;
              await ctx.runMutation(internal.messages.update, {
                messageId: assistantMessageId,
                content: initialMessageContent + "\n\n" + finalMessageContent,
              });
            }
          } else if (chunk.type === "tool_call" && chunk.toolCall) {
            isAfterToolCall = true;
            toolCalls.push({
              name: chunk.toolCall.name,
              args: JSON.stringify(chunk.toolCall.args),
            });
            await ctx.runMutation(internal.messages.update, {
              messageId: assistantMessageId,
              content: initialMessageContent,
              toolCalls: toolCalls,
            });
          }
        }
        
        await ctx.runMutation(internal.messages.finalise, {
          messageId: assistantMessageId,
          content: initialMessageContent + (finalMessageContent ? "\n\n" + finalMessageContent : ""),
        });
        
        return null;
      }
      
      // --- Original Streaming Logic (if no tools) ---
      const messagesForSdk: CoreMessage[] = [
        systemPrompt,
        ...messageHistory.map(({ content, role }) => ({
          role: role as "user" | "assistant" | "system",
          content,
        }))
      ];

      console.log(`[ai.chat] Fallback streaming - Total messages: ${messagesForSdk.length}, first message role: ${messagesForSdk[0]?.role}`);

      const streamProvider = providerStreamers[provider];
      if (!streamProvider) throw new Error(`No streamer implemented for provider: ${provider}`);
      const stream = streamProvider(apiKey, modelConfig.modelId, messagesForSdk);

      let body = "";
      for await (const textPart of stream) {
        body += textPart;
        await ctx.runMutation(internal.messages.update, {
          messageId: assistantMessageId,
          content: body,
        });
      }
      
      await ctx.runMutation(internal.messages.finalise, {
        messageId: assistantMessageId,
        content: body,
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