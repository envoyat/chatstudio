"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated } from "convex/react";

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Unauthenticated>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full space-y-8">
            <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Welcome to Chat Studio
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Please sign in to continue
              </p>
            </div>
            <div className="flex justify-center">
              <SignInButton mode="modal">
                <button className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  Sign in
                </button>
              </SignInButton>
            </div>
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <div className="min-h-screen">
          <header className="bg-white shadow">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-6">
                <h1 className="text-3xl font-bold text-gray-900">Chat Studio</h1>
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </Authenticated>
    </>
  );
} 