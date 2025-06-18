import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

export default function GuestMessageLimit() {
  return (
    <div className="text-center p-4 rounded-lg bg-secondary/30 min-h-[148px] flex flex-col justify-center items-center">
      <h3 className="font-semibold text-sm mb-2">Guest message limit reached</h3>
      <p className="text-xs text-muted-foreground mb-3">
        You've sent 10 messages. Please sign in to continue chatting and save
        your history.
      </p>
      <SignInButton mode="modal">
        <Button size="sm" className="gap-2">
          <LogIn size={16} />
          Sign In to Continue
        </Button>
      </SignInButton>
    </div>
  );
} 