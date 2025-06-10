"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, User } from "lucide-react";

export function AuthButton() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <User className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    );
  }

  if (isAuthenticated) {
    return (
      <Button variant="ghost" size="sm" onClick={() => void signOut()}>
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    );
  }

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={() => void signIn("google")}
    >
      <LogIn className="h-4 w-4 mr-2" />
      Sign In with Google
    </Button>
  );
} 