import { Loader2, Check } from "lucide-react";
import { memo } from "react";
import type { ToolCall, ToolOutput, WebSearchArgs } from "@/convex/types";

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
  toolOutputs?: ToolOutput[];
}

function isWebSearchArgs(args: unknown): args is WebSearchArgs {
  return typeof args === 'object' && args !== null && 'query' in args && typeof (args as any).query === 'string';
}

function PureToolCallDisplay({ toolCalls, toolOutputs = [] }: ToolCallDisplayProps) {
  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  const isToolCallComplete = (toolCallId: string) => {
    return toolOutputs.some(output => output.toolCallId === toolCallId);
  };

  // Consolidate web searches
  const webSearches = toolCalls.filter(call => call.name === "web_search");
  const otherToolCalls = toolCalls.filter(call => call.name !== "web_search");

  const areAllWebSearchesComplete = webSearches.every(call => isToolCallComplete(call.id));

  return (
    <div className="flex flex-col gap-2 my-2">
      {webSearches.length > 0 && (
        <div className="flex items-start gap-3 text-muted-foreground bg-secondary/50 rounded-lg px-4 py-3 text-sm border">
          {areAllWebSearchesComplete ? (
            <Check className="h-5 w-5 mt-0.5 text-green-500 flex-shrink-0" />
          ) : (
            <Loader2 className="h-5 w-5 mt-0.5 animate-spin flex-shrink-0" />
          )}
          <div className="flex flex-col">
            <span>{areAllWebSearchesComplete ? 'Searched the web for:' : 'Searching the web for:'}</span>
            <div className="flex flex-col items-start font-semibold text-foreground">
              {webSearches.map((call, index) => {
                if (isWebSearchArgs(call.args)) {
                  return <span key={index}>"{call.args.query}"</span>;
                } else {
                  console.warn('Invalid web search args:', call.args);
                  return null;
                }
              })}
            </div>
          </div>
        </div>
      )}

      {otherToolCalls.map((call, index) => {
        const isComplete = isToolCallComplete(call.id);
        return (
          <div key={index} className="flex items-center gap-3 text-muted-foreground bg-secondary/50 rounded-lg px-4 py-3 text-sm border">
            {isComplete ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
            <span>{isComplete ? 'Used tool:' : 'Using tool:'} <strong>{call.name}</strong></span>
          </div>
        );
      })}
    </div>
  );
}

const ToolCallDisplay = memo(PureToolCallDisplay);
ToolCallDisplay.displayName = "ToolCallDisplay";

export default ToolCallDisplay; 