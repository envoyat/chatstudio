// Host configuration for fallback API keys
export const getHostAPIKey = (provider: string): string | null => {
  if (typeof window !== "undefined") {
    // Client-side: return null, host keys are server-side only
    return null
  }
  
  // Server-side: access environment variables
  switch (provider) {
    case "google":
      return process.env.HOST_GOOGLE_API_KEY || null
    default:
      return null
  }
}

// Client-side function to check if host keys are available
export const hasHostAPIKey = (provider: string): boolean => {
  // For now, we assume Google host key is available
  // This could be enhanced to make an API call to check availability
  return provider === "google"
}

// Free models that can use host API keys
export const FREE_MODELS_WITH_HOST_KEY = [
  "Gemini 2.5 Flash",
  "Gemini 2.5 Flash-Lite Preview"
] as const 