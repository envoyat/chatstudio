# Convex + Clerk Setup Instructions

This Chat Studio application now uses Convex as the backend with Clerk for authentication. Users can chat without logging in (data stored temporarily in memory), but signing in with Google allows chat history to be saved permanently.

## Environment Variables Required

Add these to your `.env.local` file:

```bash
# Convex (already configured)
CONVEX_DEPLOYMENT=dev:proper-puma-280
NEXT_PUBLIC_CONVEX_URL=https://proper-puma-280.convex.cloud

# Clerk (already configured)  
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_dm9jYWwtYmVhci0xNS5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_Df2bDWBtKnZBVygSHYlrfPT22kvQgHMd5KoiiuJWKi%

# Additional required for Convex-Clerk integration
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://vocal-bear-15.clerk.accounts.dev
```

## How It Works

### Authentication States

1. **Unauthenticated Users**:
   - Can chat normally
   - Messages are stored in memory (temporary)
   - Chat history is lost on page refresh
   - Sidebar shows "Login to Save Chat Threads" message

2. **Authenticated Users**:
   - Can chat and save conversations
   - Chat threads are permanently stored in Convex
   - Can access chat history from any device
   - Sidebar shows saved chat threads

### Google OAuth Only

The Clerk configuration is set to show Google OAuth as the primary/only sign-in option by hiding other social buttons in the appearance settings.

### Data Flow

1. **User sends message** → Chat component
2. **If authenticated**: Message saved to Convex database
3. **If not authenticated**: Message saved to temporary memory storage
4. **AI response** → Always saved to same storage as user message
5. **Thread creation**: Only happens for authenticated users

## Running the Application

1. **Start Convex development server** (in one terminal):
   ```bash
   bunx convex dev
   ```

2. **Start Next.js development server** (in another terminal):
   ```bash
   bun run dev
   ```

3. **Open browser**: Navigate to `http://localhost:3000`

## Features Implemented

- ✅ Convex backend with real-time database
- ✅ Clerk authentication with Google OAuth only
- ✅ Dual storage: Convex for authenticated, memory for unauthenticated
- ✅ Chat sidebar with authentication-aware UI
- ✅ Thread management (create, delete for authenticated users)
- ✅ Message persistence
- ✅ User authentication state handling
- ✅ Automatic thread creation on first message

## Database Schema

### Tables Created in Convex:

1. **threads**
   - title: string
   - userId: string (Clerk user ID)
   - createdAt: number
   - updatedAt: number
   - lastMessageAt: number

2. **messages**
   - threadId: Id<"threads">
   - content: string
   - role: "user" | "assistant" | "system" | "data"
   - parts: any (UIMessage parts)
   - createdAt: number

3. **messageSummaries**
   - threadId: Id<"threads">
   - messageId: Id<"messages">
   - content: string
   - createdAt: number

## Next Steps for Production

1. **Update environment variables for production Clerk instance**
2. **Deploy Convex to production**: `bunx convex deploy`
3. **Configure production domain in Clerk dashboard**
4. **Update NEXT_PUBLIC_CLERK_FRONTEND_API_URL for production**

## Troubleshooting

- **Authentication not working**: Check that `NEXT_PUBLIC_CLERK_FRONTEND_API_URL` matches your Clerk instance
- **Convex connection issues**: Ensure `NEXT_PUBLIC_CONVEX_URL` is correct
- **Database errors**: Run `bunx convex dev` to sync schema changes 