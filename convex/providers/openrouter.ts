"use node";
import { OpenAI } from "openai";
import type { CoreMessage } from "ai";

export async function* stream(
  apiKey: string,
  model: string,
  messages: CoreMessage[]
): AsyncIterable<string> {
  const openrouter = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
  
  const stream = await openrouter.chat.completions.create({
    model,
    stream: true,
    messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  });

  for await (const part of stream) {
    const delta = part.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
} 