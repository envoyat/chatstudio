import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// New helper function to get the Convex HTTP action URL
export function getConvexHttpUrl(path: string): string {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not defined. Ensure it is set in your environment variables.");
  }
  // Replace ".convex.cloud" (used for Convex functions) with ".convex.site" (for HTTP actions)
  const httpBaseUrl = convexUrl.replace(".convex.cloud", ".convex.site");
  return `${httpBaseUrl}${path}`;
}
