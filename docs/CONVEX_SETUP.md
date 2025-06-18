# Convex Chat Studio Setup Instructions

Chat Studio is a modern AI chat application built with Convex as the backend database and API layer. The application supports multiple AI providers and includes features like chat threads, message persistence, and automatic title generation.

## Deployment URLs

### Development Environment
- **Convex URL**: https://example-dev-123.convex.cloud
- **Convex Deployment**: `dev:example-dev-123`

### Production Environment  
- **Convex URL**: https://example-prod-456.convex.cloud
- **Convex Deployment**: `prod:example-prod-456`

## Environment Variables Required

### Local Development (.env.local)

```bash
# Convex Configuration
CONVEX_DEPLOYMENT=dev:proper-puma-280
NEXT_PUBLIC_CONVEX_URL=https://proper-puma-280.convex.cloud

# Custom Authentication (Google OAuth + JWT)
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://vocal-bear-15.clerk.accounts.dev

# Site Configuration
SITE_URL=http://localhost:3000

# Optional: Host API Keys (fallback when user doesn't provide their own)
# These should be set via: bunx convex env set <KEY_NAME> <value>
HOST_GOOGLE_API_KEY=your_google_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here  
OPENAI_API_KEY=your_openai_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### Convex Environment Variables

Set these in your Convex deployment using `bunx convex env set <KEY_NAME> <value>`:

```bash
# Authentication (Already configured)
AUTH_GOOGLE_ID=<GOOGLE_AUTH_ID>
AUTH_GOOGLE_SECRET=<AUTH_SECRET>clear
JWT_PRIVATE_KEY=<already-set>
JWKS=<already-set>
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://vocal-bear-15.clerk.accounts.dev
SITE_URL=http://localhost:3000

# AI Provider API Keys (Host fallbacks - RECOMMENDED TO SET)
HOST_GOOGLE_API_KEY=<your-google-api-key>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
OPENAI_API_KEY=<your-openai-api-key>
OPENROUTER_API_KEY=<your-openrouter-api-key>
```

## Database Schema

### Tables

1. **threads**
   - `title`: string - The thread title (auto-generated or user-set)
   - `userId`: string - User identifier from authentication
   - `uuid`: string - Unique UUID for thread identification
   - `createdAt`: number - Creation timestamp
   - `updatedAt`: number - Last update timestamp  
   - `lastMessageAt`: number - Timestamp of most recent message
   - **Indexes**: `by_user`, `by_user_and_last_message`, `by_uuid`

2. **messages**
   - `threadId`: Id<"threads"> - Reference to parent thread
   - `content`: string - Message content
   - `role`: "user" | "assistant" | "system" | "data" - Message type
   - `parts`: any - UIMessage parts for rich content
   - `createdAt`: number - Creation timestamp
   - **Indexes**: `by_thread`, `by_thread_and_created`

3. **messageSummaries**
   - `threadId`: Id<"threads"> - Reference to parent thread
   - `messageId`: Id<"messages"> - Reference to specific message
   - `content`: string - Summary/title content
   - `createdAt`: number - Creation timestamp
   - **Indexes**: `by_message`, `by_thread`

## API Functions

### Public Functions

#### Threads
- `threads.create(title, uuid?)` - Create new chat thread
- `threads.list()` - List user's threads
- `threads.get(threadId)` - Get specific thread
- `threads.getByUuid(uuid)` - Get thread by UUID
- `threads.update(threadId, title?, lastMessageAt?)` - Update thread
- `threads.remove(threadId)` - Delete thread

#### Messages  
- `messages.create(threadId, content, role, parts?)` - Create new message
- `messages.list(threadId)` - List messages in thread
- `messages.deleteTrailing(threadId, fromCreatedAt, inclusive?)` - Delete messages after timestamp
- `messages.generateTitleForMessage(threadId, messageId, prompt, isTitle?, userGoogleApiKey?)` - Generate title for message

### Internal Functions
- `threads.internalUpdateTitle(threadId, title)` - Internal title update
- `messages.internalCreateSummary(threadId, messageId, content)` - Internal summary creation
- `ai.generateTitle(prompt, messageId, threadId, isTitle?, userGoogleApiKey?)` - AI title generation

### HTTP Endpoints

#### POST /api/chat
Primary chat endpoint supporting streaming responses
- **Body**: `{ messages, model, userApiKey? }`
- **Supported Models**: 13 models across 4 providers (Google, OpenAI, Anthropic, OpenRouter)
- **Features**: Auto-fallback to host API keys, CORS support, streaming responses

## AI Model Support

### Supported Providers & Models

#### Google (Gemini)
- Gemini 2.5 Pro
- Gemini 2.5 Flash  
- Gemini 2.5 Flash-Lite Preview

#### OpenAI (GPT)
- GPT-4.1
- GPT-4.1-mini
- GPT-4.1-nano
- o3
- o4-mini

#### Anthropic (Claude)
- Claude 4 Sonnet
- Claude Haiku 3.5
- Claude 4 Opus

#### OpenRouter
- DeepSeek R1
- Gemini 2.0 Flash (via OpenRouter)

### API Key Management
- **User Keys**: Users can provide their own API keys for any provider
- **Host Fallback**: When user key unavailable, falls back to host-configured keys
- **Automatic Title Generation**: Uses Google Gemini for generating chat titles

## Features Implemented

- ✅ Multi-provider AI chat with 13+ models
- ✅ Real-time streaming responses via HTTP endpoint
- ✅ Custom JWT-based authentication with Google OAuth
- ✅ Persistent chat threads and message history
- ✅ Automatic title generation using AI
- ✅ Message summaries and search capabilities
- ✅ CORS-enabled API for web clients
- ✅ Fallback API key system (user → host)
- ✅ Thread management (create, update, delete)
- ✅ Message management with timestamp-based deletion

## Running the Application

### 1. Start Convex Development Server
```bash
bunx convex dev
```

### 2. Start Next.js Development Server  
```bash
bun run dev
```

### 3. Access Application
Navigate to `http://localhost:3000`

## Production Deployment

### 1. Deploy to Convex Production
```bash
bunx convex deploy --prod
```

### 2. Update Environment Variables for Production
```bash
# Update site URL for production
bunx convex env set SITE_URL https://your-production-domain.com --prod

# Set production API keys
bunx convex env set HOST_GOOGLE_API_KEY <your-key> --prod
bunx convex env set ANTHROPIC_API_KEY <your-key> --prod
bunx convex env set OPENAI_API_KEY <your-key> --prod
bunx convex env set OPENROUTER_API_KEY <your-key> --prod
```

### 3. Update Local Environment for Production
```bash
# In .env.local for production builds
CONVEX_DEPLOYMENT=prod:curious-zebra-885
NEXT_PUBLIC_CONVEX_URL=https://curious-zebra-885.convex.cloud
```

## Important Notes

1. **API Keys**: Set host API keys in Convex environment variables to provide fallback when users don't have their own keys
2. **Authentication**: Uses custom JWT-based auth with Google OAuth, not standard Clerk
3. **Models**: Support for 13 different AI models across 4 major providers
4. **Streaming**: All chat responses are streamed for better user experience
5. **CORS**: Properly configured for web client integration

## Troubleshooting

- **"API key required" errors**: Set host API keys using `bunx convex env set`
- **Authentication issues**: Check `NEXT_PUBLIC_CLERK_FRONTEND_API_URL` configuration
- **Model not working**: Verify the specific provider's API key is configured
- **Database errors**: Run `bunx convex dev` to sync schema changes
- **CORS errors**: Check `CLIENT_ORIGIN` environment variable 