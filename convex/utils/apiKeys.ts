import { PROVIDERS } from "../constants";

/**
 * Helper to get API key from Convex environment variables.
 * These environment variables must be set in your Convex dashboard or via `npx convex env set`.
 */
export const getApiKeyFromConvexEnv = (providerKey: string): string | undefined => {
  switch (providerKey) {
    case PROVIDERS.GOOGLE:
      return process.env.HOST_GOOGLE_API_KEY;
    case PROVIDERS.ANTHROPIC:
      return process.env.ANTHROPIC_API_KEY;
    case PROVIDERS.OPENAI:
      return process.env.OPENAI_API_KEY;
    case PROVIDERS.OPENROUTER:
      return process.env.OPENROUTER_API_KEY;
    default:
      return undefined;
  }
}; 