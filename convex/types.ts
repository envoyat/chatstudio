import { z } from 'zod';

// Tool system types
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolOutput {
  toolCallId: string;
  result: unknown;
}

// Web search specific types
export interface WebSearchArgs {
  query: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  score?: number;
}

export interface WebSearchResponse {
  results: WebSearchResult[];
  query: string;
  follow_up_questions?: string[];
  answer?: string;
  response_time?: number;
}

// Message parts types
export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolCallId: string; result: unknown }
  | { type: 'image'; image: string; mimeType?: string }
  | { type: 'reasoning'; text: string };

// UI Message data structure
export interface UIMessageData {
  toolCalls?: ToolCall[];
  toolOutputs?: ToolOutput[];
  isComplete?: boolean;
}

// Zod schemas for validation
export const webSearchArgsSchema = z.object({
  query: z.string().describe("The search query to use. Be specific and concise. Focus on key terms relevant to the user's question."),
});

export const toolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  args: z.record(z.unknown()),
});

export const toolOutputSchema = z.object({
  toolCallId: z.string(),
  result: z.unknown(),
});

export const messagePartSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('tool-call'),
    id: z.string(),
    name: z.string(),
    args: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal('tool-result'),
    toolCallId: z.string(),
    result: z.unknown(),
  }),
  z.object({
    type: z.literal('image'),
    image: z.string(),
    mimeType: z.string().optional(),
  }),
  z.object({
    type: z.literal('reasoning'),
    text: z.string(),
  }),
]);

// Type guards
export function isToolCall(part: MessagePart): part is Extract<MessagePart, { type: 'tool-call' }> {
  return part.type === 'tool-call';
}

export function isToolResult(part: MessagePart): part is Extract<MessagePart, { type: 'tool-result' }> {
  return part.type === 'tool-result';
}

export function isTextPart(part: MessagePart): part is Extract<MessagePart, { type: 'text' }> {
  return part.type === 'text';
}

export function isImagePart(part: MessagePart): part is Extract<MessagePart, { type: 'image' }> {
  return part.type === 'image';
}

export function isReasoningPart(part: MessagePart): part is Extract<MessagePart, { type: 'reasoning' }> {
  return part.type === 'reasoning';
}

// Helper functions
export function parseWebSearchArgs(args: unknown): WebSearchArgs {
  return webSearchArgsSchema.parse(args);
}

export function isWebSearchResult(result: unknown): result is WebSearchResult[] {
  try {
    const parsed = JSON.parse(typeof result === 'string' ? result : JSON.stringify(result));
    return Array.isArray(parsed) && parsed.every(item => 
      typeof item === 'object' && 
      item !== null && 
      'title' in item && 
      'url' in item && 
      'content' in item
    );
  } catch {
    return false;
  }
} 