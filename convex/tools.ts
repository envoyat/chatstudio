"use node";

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
    description: "Search the web for current information. Use this tool when you need up-to-date information about recent events, current affairs, real-time data (stock prices, weather, sports scores), or specific facts that may have changed recently. Always provide clear citations when using search results.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to use. Be specific and concise. Focus on key terms relevant to the user's question.",
        },
      },
      required: ["query"],
    },
  },
};

// Helper function to get available tools based on settings
export function getAvailableTools(isWebSearchEnabled?: boolean): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  
  if (isWebSearchEnabled) {
    tools.push(webSearchTool);
  }
  
  return tools;
} 