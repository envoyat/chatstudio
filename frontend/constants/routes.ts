export const ROUTES = {
  HOME: "/",
  CHAT: "/chat",
  CHAT_THREAD: (threadId: string) => `/chat/${threadId}`,
  SETTINGS: "/settings",
} as const

// Type helper for route paths
export type RoutePath = typeof ROUTES[keyof typeof ROUTES] | ReturnType<typeof ROUTES.CHAT_THREAD> 