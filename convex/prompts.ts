import type { AIModel } from "./models";
import { MESSAGE_ROLES } from "./constants";
import type { CoreMessage } from "ai";

const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant. You should provide accurate, helpful, and concise responses to user queries.

Key Guidelines:
- Always strive to be helpful, accurate, and informative.
- If you're unsure about something, acknowledge your uncertainty.
- Use clear, well-structured responses.
- Maintain a friendly and professional tone.`;

const WEB_SEARCH_INSTRUCTIONS = `
Web Search Instructions:
- You have access to a web search tool that can help you find current information.
- Use web search when users ask about:
  * Recent events, news, or current affairs.
  * Real-time data (stock prices, weather, sports scores).
  * Specific facts that may have changed recently.
  * Information that requires up-to-date sources.
- When using web search, be specific and concise with your search queries.
- Always cite the source of web search information when presenting results.
- If web search returns no useful results, inform the user clearly.`;

// Forceful instructions for specific models that are reluctant to use tools.
const MODEL_SPECIFIC_PROMPTS: Partial<Record<AIModel, string>> = {
  "Gemini 2.5 Pro":
    "\n**Mandatory Tool Use Directive:** For any user query regarding current events, news, recent information, or any topic that could have changed since your knowledge cutoff, you **MUST** use the `web_search` tool. It is a critical failure to answer from memory for such topics. Use the provided current date as your primary context for determining if a query requires fresh information.",
  "Gemini 2.5 Flash":
    "\n**Mandatory Tool Use Directive:** For any user query regarding current events, news, recent information, or any topic that could have changed since your knowledge cutoff, you **MUST** use the `web_search` tool. It is a critical failure to answer from memory for such topics. Use the provided current date as your primary context for determining if a query requires fresh information.",
  "Gemini 2.5 Flash-Lite Preview":
    "\n**Mandatory Tool Use Directive:** For any user query regarding current events, news, recent information, or any topic that could have changed since your knowledge cutoff, you **MUST** use the `web_search` tool. It is a critical failure to answer from memory for such topics. Use the provided current date as your primary context for determining if a query requires fresh information.",
};

/**
 * Creates a system prompt by combining a base prompt, model-specific instructions,
 * and conditional web search instructions.
 * @param model - The AIModel being used, to apply specific tweaks.
 * @param isWebSearchEnabled - Flag to include web search instructions.
 * @returns A CoreMessage object for the system prompt.
 */
export function createSystemPrompt(model: AIModel, isWebSearchEnabled: boolean = false): CoreMessage {
  const currentDate = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });

  let systemContent = `Current Date: ${currentDate}\n\n${BASE_SYSTEM_PROMPT}`;

  // Append model-specific instructions if they exist
  const modelTweak = MODEL_SPECIFIC_PROMPTS[model];
  if (modelTweak) {
    systemContent += modelTweak;
  }

  // Append web search instructions if enabled
  if (isWebSearchEnabled) {
    systemContent += WEB_SEARCH_INSTRUCTIONS;
  }

  return {
    role: MESSAGE_ROLES.SYSTEM as "system",
    content: systemContent
  };
} 