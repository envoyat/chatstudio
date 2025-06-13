"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { tavily } from "@tavily/core";

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
    const tvly = tavily({ apiKey: tavilyApiKey });

    try {
      const searchResult = await tvly.search(query, {
        maxResults: 5,
        includeImages: false,
      });

      // Format the results into a JSON string for the LLM to process.
      return JSON.stringify(searchResult.results);
    } catch (error: any) {
      console.error("Tavily search failed:", error);
      return `Error performing web search: ${error.message}`;
    }
  },
}); 