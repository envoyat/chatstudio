"use node";
import Anthropic from "@anthropic-ai/sdk";
import type { CoreMessage } from "ai";
import { MESSAGE_ROLES } from "../constants";

// Helper to format messages for Anthropic's SDK
const formatMessages = (messages: CoreMessage[]) => {
  return messages
    .filter(
      (msg) =>
        (msg.role === MESSAGE_ROLES.USER || msg.role === MESSAGE_ROLES.ASSISTANT) &&
        typeof msg.content === "string"
    )
    .map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content as string,
    }));
};

export async function* stream(
  apiKey: string,
  model: string,
  messages: CoreMessage[]
): AsyncIterable<string> {
  const anthropic = new Anthropic({ apiKey });
  const stream = await anthropic.messages.create({
    model,
    max_tokens: 4096, // Anthropic requires max_tokens
    messages: formatMessages(messages),
    stream: true,
  });

  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      yield chunk.delta.text;
    }
  }
} 