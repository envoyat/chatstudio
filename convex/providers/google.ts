"use node";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CoreMessage } from "ai";
import { MESSAGE_ROLES } from "../constants";

// Helper to format messages for Google's SDK
const formatMessages = (messages: CoreMessage[]) => {
  return messages
    .filter(
      (msg) =>
        (msg.role === MESSAGE_ROLES.USER || msg.role === MESSAGE_ROLES.ASSISTANT) &&
        typeof msg.content === "string"
    )
    .map((msg) => ({
      role: msg.role === MESSAGE_ROLES.ASSISTANT ? "model" : "user",
      parts: [{ text: msg.content as string }],
    }));
};

export async function* stream(
  apiKey: string,
  model: string,
  messages: CoreMessage[]
): AsyncIterable<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const googleModel = genAI.getGenerativeModel({ model });

  const result = await googleModel.generateContentStream({
    contents: formatMessages(messages),
  });

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      yield chunkText;
    }
  }
} 