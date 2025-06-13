"use node";
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CoreMessage } from "ai";
import { MESSAGE_ROLES } from "./constants";
import type { Provider } from "./models";

// Tool definition types
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  id?: string;
  name: string;
  args: any;
}

export interface ToolResult {
  toolCallId?: string;
  content: string;
}

// Web search tool definition
export const webSearchTool: ToolDefinition = {
  type: "function",
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

// Provider-specific tool calling implementations
export class ToolCallingProvider {
  constructor(
    private provider: Provider,
    private apiKey: string,
    private model: string
  ) {}

  async executeWithTools(
    messages: CoreMessage[],
    tools: ToolDefinition[],
    onToolCall: (toolCall: ToolCall) => Promise<string>
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    switch (this.provider) {
      case "openai":
      case "openrouter":
        return this.executeOpenAI(messages, tools, onToolCall);
      case "anthropic":
        return this.executeAnthropic(messages, tools, onToolCall);
      case "google":
        return this.executeGoogle(messages, tools, onToolCall);
      default:
        throw new Error(`Tool calling not implemented for provider: ${this.provider}`);
    }
  }

  private async executeOpenAI(
    messages: CoreMessage[],
    tools: ToolDefinition[],
    onToolCall: (toolCall: ToolCall) => Promise<string>
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const client = this.provider === "openrouter"
      ? new OpenAI({ apiKey: this.apiKey, baseURL: "https://openrouter.ai/api/v1" })
      : new OpenAI({ apiKey: this.apiKey });

    const openAIMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages
      .map(msg => {
        if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') {
          return { role: msg.role, content: msg.content as string };
        }
        return null;
      })
      .filter(Boolean) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

    const response = await client.chat.completions.create({
      model: this.model,
      messages: openAIMessages,
      tools: tools as any,
      tool_choice: "auto",
    });

    const assistantMessage = response.choices[0].message;

    if (assistantMessage.tool_calls) {
      const toolCalls: ToolCall[] = assistantMessage.tool_calls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments),
      }));

      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map(async (toolCall) => {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await onToolCall({ 
            id: toolCall.id, 
            name: toolCall.function.name, 
            args 
          });
          return {
            role: 'tool' as const,
            content: result,
            tool_call_id: toolCall.id,
          };
        })
      );

      const finalMessages = [
        ...openAIMessages,
        {
          ...assistantMessage,
          tool_calls: assistantMessage.tool_calls?.map(tc => ({
            ...tc,
            type: "function" as const
          }))
        },
        ...toolResults,
      ];

      const finalResponse = await client.chat.completions.create({
        model: this.model,
        messages: finalMessages,
      });

      return {
        content: finalResponse.choices[0].message.content || "",
        toolCalls,
      };
    }

    return {
      content: assistantMessage.content || "",
    };
  }

  private async executeAnthropic(
    messages: CoreMessage[],
    tools: ToolDefinition[],
    onToolCall: (toolCall: ToolCall) => Promise<string>
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const anthropic = new Anthropic({ apiKey: this.apiKey });

    const anthropicTools = tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: {
        type: "object" as const,
        properties: tool.function.parameters.properties,
        required: tool.function.parameters.required,
      },
    }));

    const anthropicMessages = messages
      .filter(msg => msg.role === MESSAGE_ROLES.USER || msg.role === MESSAGE_ROLES.ASSISTANT)
      .map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content as string,
      }));

    const response = await anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: anthropicMessages,
      tools: anthropicTools,
    });

    let finalContent = "";
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        finalContent += block.text;
      } else if (block.type === "tool_use") {
        const toolCall: ToolCall = {
          id: block.id,
          name: block.name,
          args: block.input,
        };
        toolCalls.push(toolCall);

        const result = await onToolCall(toolCall);

        // For Anthropic, we need to make another call with the tool result
        const followUpMessages = [
          ...anthropicMessages,
          {
            role: "assistant" as const,
            content: response.content,
          },
          {
            role: "user" as const,
            content: [
              {
                type: "tool_result" as const,
                tool_use_id: block.id,
                content: result,
              },
            ],
          },
        ];

        const followUpResponse = await anthropic.messages.create({
          model: this.model,
          max_tokens: 4096,
          messages: followUpMessages,
        });

        for (const followUpBlock of followUpResponse.content) {
          if (followUpBlock.type === "text") {
            finalContent += followUpBlock.text;
          }
        }
      }
    }

    return {
      content: finalContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  private async executeGoogle(
    messages: CoreMessage[],
    tools: ToolDefinition[],
    onToolCall: (toolCall: ToolCall) => Promise<string>
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({ 
      model: this.model,
      tools: [{
        functionDeclarations: tools.map(tool => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: {
            type: "OBJECT" as any,
            properties: tool.function.parameters.properties,
            required: tool.function.parameters.required,
          },
        })),
      }],
    });

    const googleMessages = messages
      .filter(msg => msg.role === MESSAGE_ROLES.USER || msg.role === MESSAGE_ROLES.ASSISTANT)
      .map(msg => ({
        role: msg.role === MESSAGE_ROLES.ASSISTANT ? "model" : "user",
        parts: [{ text: msg.content as string }],
      }));

    const chat = model.startChat({
      history: googleMessages.slice(0, -1),
    });

    const result = await chat.sendMessage(googleMessages[googleMessages.length - 1].parts[0].text);
    const response = result.response;

    let finalContent = "";
    const toolCalls: ToolCall[] = [];

    // Check if the response contains function calls
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      for (const functionCall of functionCalls) {
        const toolCall: ToolCall = {
          name: functionCall.name,
          args: functionCall.args,
        };
        toolCalls.push(toolCall);

        const toolResult = await onToolCall(toolCall);

        // Send the function response back to continue the conversation
        const functionResponse = await chat.sendMessage([{
          functionResponse: {
            name: functionCall.name,
            response: { result: toolResult },
          },
        }]);

        finalContent = functionResponse.response.text();
      }
    } else {
      finalContent = response.text();
    }

    return {
      content: finalContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  // Stream with tools support
  async* streamWithTools(
    messages: CoreMessage[],
    tools: ToolDefinition[],
    onToolCall: (toolCall: ToolCall) => Promise<string>
  ): AsyncIterable<{ type: "text" | "tool_call" | "tool_result"; content: string; toolCall?: ToolCall }> {
    switch (this.provider) {
      case "openai":
      case "openrouter":
        yield* this.streamOpenAI(messages, tools, onToolCall);
        break;
      case "anthropic":
        yield* this.streamAnthropic(messages, tools, onToolCall);
        break;
      case "google":
        yield* this.streamGoogle(messages, tools, onToolCall);
        break;
      default:
        throw new Error(`Streaming with tools not implemented for provider: ${this.provider}`);
    }
  }

  private async* streamOpenAI(
    messages: CoreMessage[],
    tools: ToolDefinition[],
    onToolCall: (toolCall: ToolCall) => Promise<string>
  ): AsyncIterable<{ type: "text" | "tool_call" | "tool_result"; content: string; toolCall?: ToolCall }> {
    const client = this.provider === "openrouter"
      ? new OpenAI({ apiKey: this.apiKey, baseURL: "https://openrouter.ai/api/v1" })
      : new OpenAI({ apiKey: this.apiKey });

    const openAIMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages
      .map(msg => {
        if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') {
          return { role: msg.role, content: msg.content as string };
        }
        return null;
      })
      .filter(Boolean) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

    const stream = await client.chat.completions.create({
      model: this.model,
      messages: openAIMessages,
      tools: tools as any,
      tool_choice: "auto",
      stream: true,
    });

    let currentToolCall: any = null;
    const toolCalls: any[] = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      if (delta?.content) {
        yield { type: "text", content: delta.content };
      }

      if (delta?.tool_calls) {
        for (const toolCallDelta of delta.tool_calls) {
          if (toolCallDelta.id) {
            currentToolCall = {
              id: toolCallDelta.id,
              function: { name: toolCallDelta.function?.name || "", arguments: "" },
            };
            toolCalls.push(currentToolCall);
          }
          if (toolCallDelta.function?.arguments) {
            currentToolCall.function.arguments += toolCallDelta.function.arguments;
          }
        }
      }
    }

    // Process tool calls if any
    if (toolCalls.length > 0) {
      const toolResults = [];
      for (const toolCall of toolCalls) {
        const args = JSON.parse(toolCall.function.arguments);
        const tc: ToolCall = {
          id: toolCall.id,
          name: toolCall.function.name,
          args,
        };
        yield { type: "tool_call", content: "", toolCall: tc };

        const result = await onToolCall(tc);
        yield { type: "tool_result", content: result };
        
        toolResults.push({
          role: 'tool' as const,
          content: result,
          tool_call_id: toolCall.id,
        });
      }

      // Get final response after tool calls
      const finalMessages = [
        ...openAIMessages,
        { 
          role: 'assistant' as const, 
          tool_calls: toolCalls.map(tc => ({
            ...tc,
            type: "function" as const
          }))
        },
        ...toolResults,
      ];

      const finalStream = await client.chat.completions.create({
        model: this.model,
        messages: finalMessages,
        stream: true,
      });

      for await (const chunk of finalStream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { type: "text", content: delta };
        }
      }
    }
  }

  private async* streamAnthropic(
    messages: CoreMessage[],
    tools: ToolDefinition[],
    onToolCall: (toolCall: ToolCall) => Promise<string>
  ): AsyncIterable<{ type: "text" | "tool_call" | "tool_result"; content: string; toolCall?: ToolCall }> {
    // Anthropic's streaming with tools is more complex
    // For now, we'll use the non-streaming version and yield the result
    const result = await this.executeAnthropic(messages, tools, onToolCall);
    
    if (result.toolCalls) {
      for (const toolCall of result.toolCalls) {
        yield { type: "tool_call", content: "", toolCall };
      }
    }
    
    yield { type: "text", content: result.content };
  }

  private async* streamGoogle(
    messages: CoreMessage[],
    tools: ToolDefinition[],
    onToolCall: (toolCall: ToolCall) => Promise<string>
  ): AsyncIterable<{ type: "text" | "tool_call" | "tool_result"; content: string; toolCall?: ToolCall }> {
    // Google's streaming with tools is also complex
    // For now, we'll use the non-streaming version and yield the result
    const result = await this.executeGoogle(messages, tools, onToolCall);
    
    if (result.toolCalls) {
      for (const toolCall of result.toolCalls) {
        yield { type: "tool_call", content: "", toolCall };
      }
    }
    
    yield { type: "text", content: result.content };
  }
}

// Helper function to get available tools based on settings
export function getAvailableTools(isWebSearchEnabled?: boolean): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  
  if (isWebSearchEnabled) {
    tools.push(webSearchTool);
  }
  
  return tools;
} 