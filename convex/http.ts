import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, tool } from "ai";
import { z } from "zod";
import { TavilyClient } from "tavily";
import { MODEL_CONFIGS, type AIModel, type ModelConfig } from "./models";
import { getApiKeyFromConvexEnv } from "./utils/apiKeys";

const http = httpRouter();

// Create the web search tool using Tavily
const webSearchTool = tool({
  description: 'Search the web for current information about a topic',
  parameters: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }) => {
    const tavilyApiKey = process.env.TAVILY_KEY;
    if (!tavilyApiKey) {
      throw new Error('Tavily API key not found');
    }

    const tavilyClient = new TavilyClient({ apiKey: tavilyApiKey });
    
    try {
      const response = await tavilyClient.search({
        query,
        search_depth: "basic",
        include_images: false,
        include_answer: true,
        max_results: 5,
      });

      return {
        query,
        results: response.results.map((result: any) => ({
          title: result.title,
          url: result.url,
          content: result.content,
          score: result.score,
        })),
        answer: response.answer,
      };
    } catch (error) {
      console.error('Tavily search error:', error);
      throw new Error(`Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { messages, model, userApiKey, webSearchEnabled, temperature } = await request.json();

    try {
      const aiModelName = model as AIModel;
      const modelConfig: ModelConfig = MODEL_CONFIGS[aiModelName];

      let apiKey = userApiKey; // User's key passed from client

      // If no user key, try to use host key from Convex environment variables
      if (!apiKey) {
        apiKey = getApiKeyFromConvexEnv(modelConfig.provider);
      }

      if (!apiKey) {
        return new Response(JSON.stringify({ 
          error: `API key is required for ${modelConfig.provider}. Please add your API key in settings or ensure a host key is configured.` 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
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
          return new Response(JSON.stringify({ error: "Unsupported model provider" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
      }

      const streamTextOptions: any = {
        model: aiClientModel,
        messages: messages, // Messages from the request body
        temperature: temperature || 0.7,
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

          ${webSearchEnabled ? `
          You have access to a web search tool. Use it when:
          - The user asks about current events, recent news, or time-sensitive information
          - You need up-to-date information that may have changed since your training data
          - The user specifically requests current information about a topic
          
          When you use web search, provide clear attribution to your sources and explain when the information was found.
          ` : ''}
        `,
      };

      // Add tools if web search is enabled
      if (webSearchEnabled) {
        streamTextOptions.tools = {
          webSearch: webSearchTool,
        };
      }

      const result = await streamText(streamTextOptions);

      // Respond with the stream, adding CORS headers
      return result.toDataStreamResponse({
        headers: {
          "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN || "*",
          "Vary": "Origin",
        },
      });

    } catch (error: any) {
      console.error("HTTP chat action error:", error);
      return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
        status: 500,
        headers: new Headers({
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN || "*",
          "Vary": "Origin",
        }),
      });
    }
  }),
});

// Define the OPTIONS route for /api/chat (CORS pre-flight)
http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN || "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, X-Google-API-Key, X-Anthropic-API-Key, X-OpenAI-API-Key, X-OpenRouter-API-Key",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});

// Convex expects the router to be the default export of `convex/http.js`.
export default http; 