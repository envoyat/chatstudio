"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type CoreMessage, streamText, tool } from "ai";
import { z } from 'zod';
import { createOpenAI, OpenAIProvider } from '@ai-sdk/openai';
import { createGoogleGenerativeAI, GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { AnthropicProvider, createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter, OpenRouterProvider } from "@openrouter/ai-sdk-provider";

import { createSystemPrompt } from "./prompts";
import { MODEL_CONFIGS, type AIModel, type ModelConfig, findModelConfigByModelId } from "./models";
import { getApiKeyFromConvexEnv } from "./utils/apiKeys";
import { MESSAGE_ROLES, type MessageRole, PROVIDERS, type Provider as ProviderType } from "./constants";
import { webSearchArgsSchema, type MessagePart, type ToolCall, type ToolOutput } from "./types";

// Convex validator for message parts
const messagePartValidator = v.union(
  v.object({
    type: v.literal('text'),
    text: v.string(),
  }),
  v.object({
    type: v.literal('tool-call'),
    id: v.string(),
    name: v.string(),
    args: v.any(),
  }),
  v.object({
    type: v.literal('tool-result'),
    toolCallId: v.string(),
    result: v.any(),
  }),
  v.object({
    type: v.literal('image'),
    image: v.string(), // Base64 data URL or URL
    mimeType: v.optional(v.string()),
  }),
  v.object({
    type: v.literal('reasoning'),
    text: v.string(),
  })
);

const messageValidator = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  conversationId: v.id("conversations"),
  role: v.union(v.literal(MESSAGE_ROLES.USER), v.literal(MESSAGE_ROLES.ASSISTANT), v.literal(MESSAGE_ROLES.SYSTEM), v.literal(MESSAGE_ROLES.DATA)),
  content: v.string(),
  parts: v.optional(v.array(messagePartValidator)),
  isComplete: v.optional(v.boolean()),
  createdAt: v.number(),
  toolCalls: v.optional(v.array(v.object({
    id: v.string(),
    name: v.string(),
    args: v.any(), // Keep as any for Convex validator compatibility
  }))),
  toolOutputs: v.optional(v.array(v.object({
    toolCallId: v.string(),
    result: v.any(), // Keep as any for Convex validator compatibility
  }))),
});

type ChatParams = {
  messageHistory: Doc<"messages">[];
  assistantMessageId: Doc<"messages">["_id"];
  model: string;
  provider?: string;
  conversationId: Doc<"conversations">["_id"];
  userApiKey?: string;
  isWebSearchEnabled?: boolean;
  isThinkingEnabled?: boolean;
  newAttachmentIds?: Doc<"attachments">["_id"][];
};

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
    let googleApiKey = userGoogleApiKey || getApiKeyFromConvexEnv(PROVIDERS.GOOGLE);
    
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
        model: google("gemini-2.5-flash-lite-preview-06-17"),
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Failed to generate title:", errorMessage);
      return { success: false };
    }
  },
});

export const chat = internalAction({
  args: {
    messageHistory: v.array(messageValidator),
    assistantMessageId: v.id("messages"),
    model: v.string(),
    provider: v.optional(v.string()),
    conversationId: v.id("conversations"),
    userApiKey: v.optional(v.string()),
    isWebSearchEnabled: v.optional(v.boolean()),
    isThinkingEnabled: v.optional(v.boolean()),
    newAttachmentIds: v.optional(v.array(v.id("attachments"))),
  },
  returns: v.null(),
  handler: async (ctx, { messageHistory, assistantMessageId, model, provider: providerName, conversationId, userApiKey, isWebSearchEnabled, isThinkingEnabled, newAttachmentIds }: ChatParams) => {
    try {
      // Find the base model config to get info like `supportsReasoning`
      const modelConfig = findModelConfigByModelId(model);
      
      if (!modelConfig) {
        throw new Error(`Configuration not found for model: ${model}`);
      }
      
      // The provider to use is the one sent from the frontend, or the model's default provider.
      const provider = (providerName as ProviderType) || modelConfig.provider;

      // Create the appropriate model instance based on provider
      let modelInstance;
      if (provider === PROVIDERS.OPENAI) {
        const openai = createOpenAI({ apiKey: userApiKey });
        modelInstance = openai(model);
      } else if (provider === PROVIDERS.GOOGLE) {
        // Use user's key if provided, otherwise fall back to host key. This is the only place a host key is used.
        const googleApiKey = userApiKey || getApiKeyFromConvexEnv(PROVIDERS.GOOGLE);
        const google = createGoogleGenerativeAI({ apiKey: googleApiKey });
        modelInstance = google(model);
      } else if (provider === PROVIDERS.ANTHROPIC) {
        const anthropic = createAnthropic({ apiKey: userApiKey });
        modelInstance = anthropic(model);
      } else if (provider === PROVIDERS.OPENROUTER) {
        const openrouter = createOpenRouter({
          apiKey: userApiKey,
        });
        modelInstance = openrouter(model);
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      // We need the original model name to create the correct system prompt
      const originalModelName = (Object.keys(MODEL_CONFIGS) as AIModel[]).find(
        (key) => MODEL_CONFIGS[key].modelId === model || MODEL_CONFIGS[key].openRouterModelId === model
      ) as AIModel;

      const systemPrompt = createSystemPrompt(originalModelName, isWebSearchEnabled);
      
      // Filter out the last message if it's an empty assistant placeholder, which Anthropic doesn't allow.
      const filteredHistory = messageHistory.filter(
        (message, index) =>
          !(
            index === messageHistory.length - 1 &&
            message.role === MESSAGE_ROLES.ASSISTANT &&
            message.content === ""
          )
      );

      // Convert messages to CoreMessage format, handling multi-modal content
      const processedMessages: CoreMessage[] = []
      
      for (const message of filteredHistory) {
        if (message.parts && message.parts.length > 0) {
          // Handle multi-modal messages with parts
          const content: any[] = []
          
          for (const part of message.parts) {
            if (part.type === 'text') {
              content.push({ type: 'text', text: part.text })
            } else if (part.type === 'image') {
              // Convert URL to base64 if needed for AI models
              let imageData = part.image
              if (!imageData.startsWith('data:')) {
                // If it's a URL, fetch and convert to base64
                try {
                  const response = await fetch(imageData)
                  const buffer = await response.arrayBuffer()
                  const base64 = Buffer.from(buffer).toString('base64')
                  imageData = `data:${part.mimeType || 'image/jpeg'};base64,${base64}`
                } catch (error) {
                  console.error('Failed to fetch image:', error)
                  continue // Skip this image if we can't fetch it
                }
              }
              
              content.push({
                type: 'image',
                image: imageData,
              })
            }
          }
          
          if (content.length > 0) {
            // Only user messages can have multi-modal content arrays
            if (message.role === MESSAGE_ROLES.USER) {
              processedMessages.push({
                role: 'user',
                content,
              })
            } else {
              // For assistant/system messages, extract text content
              const textContent = content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('')
              
              processedMessages.push({
                role: message.role as "assistant" | "system",
                content: textContent,
              })
            }
          }
        } else {
          // Handle text-only messages
          processedMessages.push({
            role: message.role as "user" | "assistant" | "system",
            content: message.content,
          })
        }
      }

      const messagesForSdk: CoreMessage[] = [
        systemPrompt,
        ...processedMessages,
      ];

      const tools = {
        web_search: tool({
          description: "Search the web for current information. Use this tool when you need up-to-date information about recent events, current affairs, real-time data (stock prices, weather, sports scores), or specific facts that may have changed recently. Always provide clear citations when using search results.",
          parameters: webSearchArgsSchema,
          execute: async ({ query }) => {
            return await ctx.runAction(internal.tools.webSearch.run, { query });
          }
        })
      };

      // Prepare provider-specific options if the model supports reasoning
      let providerOptions: any = {};
      if (
        modelConfig.supportsReasoning &&
        (isThinkingEnabled || !modelConfig.canToggleThinking)
      ) {
        // Check if we're using OpenRouter (either natively or as fallback)
        const isUsingOpenRouter = provider === PROVIDERS.OPENROUTER;
        
        if (isUsingOpenRouter) {
          // For OpenRouter, use their unified reasoning parameter.
          // This must be passed via the 'openrouter' providerOptions key.
          providerOptions.openrouter = {
            reasoning: {
              max_tokens: 8000,
            },
          };
        } else if (provider === PROVIDERS.GOOGLE) {
          providerOptions.google = { thinkingConfig: { includeThoughts: true } };
        } else if (provider === PROVIDERS.ANTHROPIC) {
          providerOptions.anthropic = { thinking: { type: 'enabled' as const, budgetTokens: 8000 } };
        }
      }

      const result = await streamText({
        model: modelInstance,
        messages: messagesForSdk,
        tools: isWebSearchEnabled ? tools : undefined,
        toolChoice: isWebSearchEnabled ? 'auto' : undefined,
        maxSteps: 5,
        providerOptions, // Add this to enable reasoning
      });

      let parts: MessagePart[] = [];
      
      const updateMessage = async (newReasoning?: string) => {
        const textContent = parts
          .filter((part): part is Extract<MessagePart, { type: 'text' }> => part.type === 'text')
          .map((part) => part.text)
          .join('');

        const reasoningContent = newReasoning ?? (parts.find(p => p.type === 'reasoning') as Extract<MessagePart, { type: 'reasoning' }>)?.text;

        // Separate tool calls and results for structured storage
        const toolCalls: ToolCall[] = parts
          .filter((part): part is Extract<MessagePart, { type: 'tool-call' }> => part.type === 'tool-call')
          .map(part => ({
            id: part.id,
            name: part.name,
            args: part.args, // JSON format
          }));
        
        const toolOutputs: ToolOutput[] = parts
          .filter((part): part is Extract<MessagePart, { type: 'tool-result' }> => part.type === 'tool-result')
          .map(part => ({
            toolCallId: part.toolCallId,
            result: part.result,
          }));

        await ctx.runMutation(internal.messages.update, {
          messageId: assistantMessageId,
          content: textContent,
          parts,
          reasoning: reasoningContent,
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
          case 'reasoning': {
            const existingReasoning = (parts.find(p => p.type === 'reasoning') as Extract<MessagePart, { type: 'reasoning' }>)?.text ?? "";
            const newReasoning = existingReasoning + part.textDelta;
            const reasoningPartIndex = parts.findIndex(p => p.type === 'reasoning');
            if (reasoningPartIndex !== -1) {
              parts[reasoningPartIndex] = { type: 'reasoning', text: newReasoning };
            } else {
              parts.unshift({ type: 'reasoning', text: newReasoning });
            }
            // Pass the latest reasoning text directly to avoid race conditions
            await updateMessage(newReasoning);
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
            break;
          }
          case 'error': {
            console.error('[ai.chat] Error from AI stream:', part.error);
            throw part.error;
          }
        }
      }

      const finalContent = parts
        .filter((part): part is Extract<MessagePart, { type: 'text' }> => part.type === 'text')
        .map((part) => part.text)
        .join('');

      // Before finalizing, ensure the reasoning from the temporary field is in the parts array
      const finalReasoningText = (parts.find(p => p.type === 'reasoning') as Extract<MessagePart, { type: 'reasoning' }>)?.text;
      if (finalReasoningText && !parts.some(p => p.type === 'reasoning' && p.text === finalReasoningText)) {
        const reasoningPartIndex = parts.findIndex(p => p.type === 'reasoning');
        if (reasoningPartIndex !== -1) parts[reasoningPartIndex] = { type: 'reasoning', text: finalReasoningText };
        else parts.unshift({ type: 'reasoning', text: finalReasoningText });
      }

      await ctx.runMutation(internal.messages.finalise, {
        messageId: assistantMessageId,
        content: finalContent,
        parts, // Pass final parts to be saved
      });

      // Update token counts for any attachments used in this message turn
      if (newAttachmentIds && newAttachmentIds.length > 0) {
        // For now, we'll use a placeholder token count since the AI SDK doesn't 
        // always provide usage information in the streaming response.
        // In a real implementation, you might want to:
        // 1. Use a separate token counting library
        // 2. Store token counts from the AI provider if available
        // 3. Estimate based on message content length
        const estimatedTokens = Math.max(100, finalContent.length / 4); // Rough estimate
        
        await ctx.runMutation(internal.attachments.updateTokenCountForAttachments, {
          attachmentIds: newAttachmentIds,
          promptTokens: Math.round(estimatedTokens),
        });
      }

      // Check if this is the first message exchange in the conversation
      // (only 2 messages: user's first message and assistant's response)
      if (messageHistory.length === 2) {
        const firstUserMessage = messageHistory.find(msg => msg.role === MESSAGE_ROLES.USER);
        if (firstUserMessage) {
          console.log(`[ai.chat] Generating title for conversation ${conversationId}`);
          
          // Get Google API key for title generation (fallback to host key if user hasn't provided one)
          let googleApiKey = undefined;
          if (provider === PROVIDERS.GOOGLE && userApiKey) {
            // If the current provider is Google and user provided a key, use it
            googleApiKey = userApiKey;
          } else {
            // Otherwise, try to get host Google API key from environment
            googleApiKey = getApiKeyFromConvexEnv(PROVIDERS.GOOGLE);
          }
          
          // Schedule title generation
          await ctx.scheduler.runAfter(
            0,
            internal.ai.generateTitle,
            {
              prompt: firstUserMessage.content,
              isTitle: true,
              messageId: firstUserMessage._id,
              conversationId: conversationId,
              userGoogleApiKey: googleApiKey,
            }
          );
        }
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred";
      console.error(`[ai.chat] ACTION FAILED: ${errorMessage}`, e);
      await ctx.runMutation(internal.messages.finalise, {
        messageId: assistantMessageId,
        content: `Sorry, I ran into an error: ${errorMessage}`,
        parts: [{ type: 'text', text: `Sorry, I ran into an error: ${errorMessage}` }],
      });
    }

    return null;
  },
}); 