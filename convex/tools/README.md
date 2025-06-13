# Tools Abstraction for Multi-Provider Tool Calling

This refactoring introduces a unified tool calling abstraction that works across different AI providers: OpenAI, Anthropic, Google, and OpenRouter.

## Overview

Previously, tool calling logic was embedded directly in the `ai.ts` file and was specific to OpenAI/OpenRouter providers. This refactoring extracts the tool calling logic into a separate `tools.ts` file that provides a unified interface for all providers.

## Key Components

### 1. `ToolCallingProvider` Class

The main abstraction that handles tool calling for different providers:

```typescript
const toolProvider = new ToolCallingProvider(provider, apiKey, modelId);
```

### 2. Tool Definitions

Standardised tool definitions using OpenAPI 3.0 schema format:

```typescript
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
```

### 3. Tool Calls and Results

Common interfaces for tool calls and their results:

```typescript
export interface ToolCall {
  id?: string;
  name: string;
  args: any;
}

export interface ToolResult {
  toolCallId?: string;
  content: string;
}
```

## Supported Methods

### `executeWithTools()`
Non-streaming tool execution that returns the final result with tool calls metadata.

### `streamWithTools()`
Streaming tool execution that yields chunks of different types:
- `text`: Regular content chunks
- `tool_call`: When a tool is being called
- `tool_result`: When a tool call result is received

## Provider-Specific Implementations

### OpenAI & OpenRouter
- Full streaming support with tool calls
- Proper message formatting with required `type: "function"` field
- Handles tool call deltas and reconstruction

### Anthropic
- Tool calling support with proper schema formatting
- Currently falls back to non-streaming for tool calls (streaming with tools is complex in Anthropic's API)

### Google (Gemini)
- Function calling support with Google's specific schema format
- Currently falls back to non-streaming for tool calls
- Handles function responses properly

## Available Tools

### Web Search Tool

The web search tool is automatically available when `isWebSearchEnabled` is true:

```typescript
const tools = getAvailableTools(isWebSearchEnabled);
```

## Usage in AI Chat

The refactored `ai.ts` now uses the tool calling abstraction:

```typescript
if (tools.length > 0) {
  const toolProvider = new ToolCallingProvider(provider, apiKey, modelConfig.modelId);
  
  for await (const chunk of toolProvider.streamWithTools(
    messagesForSdk,
    tools,
    async (toolCall) => {
      if (toolCall.name === 'web_search') {
        return await ctx.runAction(internal.tools.webSearch.run, { 
          query: toolCall.args.query 
        });
      }
      return "Tool not found";
    }
  )) {
    // Handle chunks...
  }
}
```

## Benefits

1. **Unified Interface**: Same API works across all providers
2. **Extensible**: Easy to add new tools and providers
3. **Type Safe**: Proper TypeScript interfaces for all components
4. **Provider-Specific Optimisations**: Each provider can implement tools in the most efficient way
5. **Maintainable**: Tool logic is separated from general AI logic

## Future Improvements

1. **Enhanced Streaming**: Implement proper streaming with tools for Anthropic and Google
2. **Tool Registry**: Dynamic tool registration system
3. **Tool Composition**: Support for complex multi-tool workflows
4. **Error Handling**: Better error recovery and fallback strategies 