"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";
import { LogIn, User } from "lucide-react";

export function AuthButton() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <User className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    );
  }

  if (isAuthenticated) {
    return <UserButton afterSignOutUrl="/" />;
  }

  return (
    <SignInButton mode="modal">
      <Button variant="ghost" size="sm">
        <LogIn className="h-4 w-4 mr-2" />
        Sign In
      </Button>
    </SignInButton>
  );
} 