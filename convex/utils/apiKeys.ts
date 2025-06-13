/**
 * Helper to get API key from Convex environment variables.
 * These environment variables must be set in your Convex dashboard or via `npx convex env set`.
 */
export const getApiKeyFromConvexEnv = (providerKey: string): string | undefined => {
  switch (providerKey) {
    case "google":
      return process.env.HOST_GOOGLE_API_KEY;
    default:
      return undefined;
  }
}; 