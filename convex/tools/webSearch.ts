"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { tavily } from "@tavily/core";
import type { WebSearchResult } from "../types";

export const run = internalAction({
  args: {
    query: v.string(),
  },
  returns: v.string(),
  handler: async (_ctx, { query }) => {
    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if (!tavilyApiKey) {
      throw new Error(
        "TAVILY_API_KEY is not set in Convex environment variables. Please add it in your project settings.",
      );
    }
    const client = tavily({ apiKey: tavilyApiKey });

    try {
      const searchResult = await client.search(query, {
        maxResults: 5,
      });

      // Validate and format the results
      const formattedResults: WebSearchResult[] = searchResult.results.map((result: any) => ({
        title: String(result.title || 'Untitled'),
        url: String(result.url || ''),
        content: String(result.content || ''),
        raw_content: result.raw_content ? String(result.raw_content) : undefined,
        score: typeof result.score === 'number' ? result.score : undefined,
      }));

      // Format the results into a JSON string for the LLM to process.
      return JSON.stringify(formattedResults);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Tavily search failed:", errorMessage);
      return `Error performing web search: ${errorMessage}`;
    }
  },
}); 