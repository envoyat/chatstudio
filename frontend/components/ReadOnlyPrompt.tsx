import { Eye } from "lucide-react";

export default function ReadOnlyPrompt() {
  return (
    <div className="w-full">
      <div className="bg-white/20 dark:bg-black/20 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-[20px] p-4 w-full transition-colors shadow-lg">
        <div className="text-center p-4 rounded-lg bg-secondary/30 min-h-[148px] flex flex-col justify-center items-center">
          <Eye className="h-8 w-8 text-muted-foreground mb-3" />
          <h3 className="font-semibold text-sm mb-2">
            This is a shared conversation
          </h3>
          <p className="text-xs text-muted-foreground">
            You are in read-only mode. Only the owner can send messages.
          </p>
        </div>
      </div>
    </div>
  );
} 