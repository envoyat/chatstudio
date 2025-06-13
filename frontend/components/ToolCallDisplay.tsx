import { Loader2 } from "lucide-react";
import { memo } from "react";

interface ToolCall {
  name: string;
  args: string;
}

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
}

function PureToolCallDisplay({ toolCalls }: ToolCallDisplayProps) {
  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 my-2">
      {toolCalls.map((call, index) => {
        if (call.name === "web_search") {
          try {
            const args = JSON.parse(call.args);
            return (
              <div key={index} className="flex items-center gap-3 text-muted-foreground bg-secondary/50 rounded-lg px-4 py-3 text-sm border">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Searching the web for: <strong>"{args.query}"</strong></span>
              </div>
            );
          } catch (e) {
            return null; // Ignore malformed JSON
          }
        }
        return (
          <div key={index} className="flex items-center gap-3 text-muted-foreground bg-secondary/50 rounded-lg px-4 py-3 text-sm border">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Using tool: <strong>{call.name}</strong></span>
          </div>
        );
      })}
    </div>
  );
}

const ToolCallDisplay = memo(PureToolCallDisplay);
ToolCallDisplay.displayName = "ToolCallDisplay";

export default ToolCallDisplay; 