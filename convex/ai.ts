"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { CoreMessage, ToolCallPart, ToolResultPart } from "ai";

import { MODEL_CONFIGS, type AIModel, type ModelConfig } from "./models";
import { getApiKeyFromConvexEnv } from "./utils/apiKeys";

// Import the stream functions from our new providers directory
import * as openai from "./providers/openai";
import * as google from "./providers/google";
import * as anthropic from "./providers/anthropic";
import * as openrouter from "./providers/openrouter";
import OpenAI from "openai";

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
  role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"), v.literal("data"), v.literal("tool")),
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

const webSearchTool = {
  type: "function" as const,
  function: {
    name: "web_search",
    description: "Search the web for information. Use this to answer questions about recent events or specific facts.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to use. Be specific and concise.",
        },
      },
      required: ["query"],
    },
  },
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
      const errorMessage = args.userGoogleApiKey 
        ? "Both user and host Google API keys are missing. Please set HOST_GOOGLE_API_KEY in Convex environment variables."
        : "No Google API key available. Either provide a user API key or set HOST_GOOGLE_API_KEY in Convex environment variables.";
      
      console.error(`Title generation failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    try {
      const stream = google.stream(googleApiKey, "gemini-2.0-flash", [
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

      const messagesForSdk: CoreMessage[] = messageHistory
        .filter(msg => msg.role !== 'tool') // Filter out tool messages for now
        .map(({ content, role, toolCalls }) => {
          if (role === "assistant" && toolCalls) {
            return {
              role: "assistant" as const,
              content: content,
              tool_calls: toolCalls as any,
            };
          }
          return { role: role as "user" | "assistant" | "system", content };
        });
      
      const tools = isWebSearchEnabled ? [webSearchTool] : undefined;

      // --- Tool-Calling Logic ---
      if (tools) {
        const oai = new OpenAI({ apiKey }); // Assuming OpenAI for simplicity, this needs to be adapted for other providers.
        
        const initialResponse = await oai.chat.completions.create({
          model: modelConfig.modelId,
          messages: messagesForSdk as any,
          tools: tools,
          tool_choice: "auto",
        });

        const assistantResponse = initialResponse.choices[0].message;

        if (assistantResponse.tool_calls) {
          // Model wants to use a tool
          await ctx.runMutation(internal.messages.update, {
            messageId: assistantMessageId,
            content: "", // Placeholder content
            toolCalls: assistantResponse.tool_calls.map(tc => ({
                name: tc.function.name,
                args: tc.function.arguments,
            })),
          });
          
          const toolResults = await Promise.all(assistantResponse.tool_calls.map(async (toolCall) => {
            if (toolCall.function.name === 'web_search') {
                const args = JSON.parse(toolCall.function.arguments);
                const searchResult = await ctx.runAction(internal.tools.webSearch.run, { query: args.query });
                return {
                    role: 'tool' as const,
                    content: searchResult,
                    tool_call_id: toolCall.id,
                };
            }
            return { 
              role: 'tool' as const, 
              content: "Tool not found", 
              tool_call_id: toolCall.id 
            };
          }));

          messagesForSdk.push(assistantResponse as CoreMessage);
          toolResults.forEach(result => messagesForSdk.push(result as CoreMessage));

          // Call model again with tool results
          const finalStream = await oai.chat.completions.create({
              model: modelConfig.modelId,
              messages: messagesForSdk as any,
              stream: true,
          });

          let body = "";
          for await (const part of finalStream) {
              const delta = part.choices[0]?.delta?.content;
              if (delta) {
                  body += delta;
                  await ctx.runMutation(internal.messages.update, { messageId: assistantMessageId, content: body });
              }
          }
          await ctx.runMutation(internal.messages.finalize, { messageId: assistantMessageId, content: body });

        } else {
          // No tool call, just finalize with the content
          await ctx.runMutation(internal.messages.finalize, {
            messageId: assistantMessageId,
            content: assistantResponse.content || "Sorry, I couldn't generate a response.",
          });
        }
        return null;
      }
      
      // --- Original Streaming Logic (if no tools) ---
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