# Chat Studio

A modern, open-source AI chat application built with Convex backend that provides access to 13+ powerful AI models including Google's Gemini, Anthropic's Claude, OpenAI's GPT, and more. Features real-time data synchronization, persistent chat history, and a beautiful responsive UI.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Next.js](https://img.shields.io/badge/Next.js-15+-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18+-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Convex](https://img.shields.io/badge/Convex-Backend-orange)](https://convex.dev/)

## ✨ Features

### 🆓 **Free AI Access**
- **No API key required** to get started
- Free access to Gemini models via host-provided API keys
- Fallback system ensures availability when user keys aren't provided

### 🔑 **Flexible API Key Management**
- **Bring your own keys** for better rate limits and premium models
- Support for **4 major AI providers** with **13+ models**:
  - 🟢 **Google AI** (Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash)
  - 🟣 **Anthropic** (Claude 4 Sonnet, Haiku 3.5, Opus)
  - 🔵 **OpenAI** (GPT-4.1, GPT-4.1-mini, GPT-4.1-nano, o3, o4-mini)
  - 🟠 **OpenRouter** (DeepSeek R1, Gemini via OpenRouter)
- Smart fallback: User keys → Host keys → Error handling

### 💬 **Modern Chat Experience**
- **Real-time streaming responses** via Convex HTTP endpoints
- **Persistent chat history** with Convex database
- **Dual storage modes**: 
  - 🔐 **Authenticated**: Permanent storage in Convex
  - 👤 **Guest**: Temporary storage in browser memory
- **Auto-generated titles** using AI
- Beautiful, responsive UI with dark/light mode
- LaTeX math rendering support
- Message editing and regeneration

### 🔒 **Authentication & Privacy**
- **Google OAuth integration** for seamless sign-in
- **Guest mode** for immediate usage without account
- **Custom JWT-based authentication** via Convex
- API keys handled securely with encryption
- Open source and transparent

### 🚀 **Real-time Backend**
- **Convex-powered backend** for real-time data sync
- **Thread management** with automatic updates
- **Message persistence** across devices
- **Automatic title generation** for conversations
- **Search and indexing** capabilities

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Convex account (free)
- Google AI API key (optional, for host setup)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/chat-studio.git
   cd chat-studio
   ```

2. **Install dependencies:**
   ```bash
   bun install
   # or
   npm install
   ```

3. **Set up Convex:**
   ```bash
   # Start Convex development server
   bunx convex dev
   ```

4. **Configure environment variables:**
   
   Create a `.env.local` file:
   ```bash
   # Convex Configuration (automatically set by convex dev)
   CONVEX_DEPLOYMENT=dev:your-deployment-name
   NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
   
   # Authentication
   NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://your-clerk-instance.clerk.accounts.dev
   
   # Site Configuration
   SITE_URL=http://localhost:3000
   ```

5. **Set up host API keys (optional):**
   ```bash
   # Provide free access to AI models for all users
   bunx convex env set HOST_GOOGLE_API_KEY your_google_api_key_here
   bunx convex env set ANTHROPIC_API_KEY your_anthropic_api_key_here
   bunx convex env set OPENAI_API_KEY your_openai_api_key_here
   bunx convex env set OPENROUTER_API_KEY your_openrouter_api_key_here
   ```

6. **Start the development server:**
   ```bash
   bun run dev
   # or
   npm run dev
   ```

7. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📚 Documentation

For detailed setup instructions, deployment guide, and API documentation:

📖 **[Convex Setup Guide](./CONVEX_SETUP.md)** - Complete backend configuration and deployment instructions

## 🔧 Configuration

### Host API Key Setup (Recommended)

To provide free access to AI models for all users:

1. Get API keys from providers:
   - [Google AI Studio](https://aistudio.google.com/apikey)
   - [Anthropic Console](https://console.anthropic.com/settings/keys)
   - [OpenAI Platform](https://platform.openai.com/settings/organization/api-keys)
   - [OpenRouter Dashboard](https://openrouter.ai/keys)

2. Set them in your Convex deployment:
   ```bash
   bunx convex env set HOST_GOOGLE_API_KEY AIza...your_key_here
   bunx convex env set ANTHROPIC_API_KEY sk-ant-...
   bunx convex env set OPENAI_API_KEY sk-...
   bunx convex env set OPENROUTER_API_KEY sk-or-...
   ```

**Benefits of host API keys:**
- Users can chat immediately without setup
- Fallback when user keys aren't provided
- Free access to multiple AI models
- Users can still add their own keys for premium features

### User API Keys

Users can add their own API keys in the app settings for:
- **Better rate limits**
- **Access to premium models**
- **Personal usage quotas**
- **Override host limitations**

## 📁 Project Structure

```
chat-studio/
├── app/                    # Next.js app router
│   ├── api/               # Legacy API routes
│   └── page.tsx           # Main page
├── components/            # Reusable UI components
├── convex/                # Convex backend
│   ├── ai.ts             # AI title generation
│   ├── http.ts           # HTTP endpoints (/api/chat)
│   ├── messages.ts       # Message operations
│   ├── threads.ts        # Thread management
│   ├── schema.ts         # Database schema
│   ├── models.ts         # AI model configurations
│   └── auth.config.ts    # Authentication config
├── frontend/              # Frontend-specific code
│   ├── components/        # React components
│   ├── hooks/            # Custom React hooks
│   ├── routes/           # Route components
│   ├── storage/          # Local storage utilities
│   └── stores/           # Zustand state management
├── lib/                  # Shared utilities
├── styles/               # Global styles
└── public/              # Static assets
```

## 🛠️ Technology Stack

### Backend
- **Database:** Convex (real-time database)
- **API:** Convex HTTP actions
- **Authentication:** Custom JWT with Google OAuth
- **AI Integration:** Vercel AI SDK

### Frontend
- **Framework:** Next.js 15 with App Router
- **Frontend:** React 18, TypeScript
- **Routing:** React Router (client-side)
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** Zustand
- **Local Storage:** Browser memory (guest mode)
- **Package Manager:** Bun

## 🎯 Supported AI Models

### Google AI (Gemini)
- ✅ Gemini 2.5 Pro (`gemini-2.5-pro-preview-05-06`)
- ✅ Gemini 2.5 Flash (`gemini-2.5-flash-preview-04-17`)
- ✅ Gemini 2.5 Flash-Lite Preview (`gemini-2.5-flash-lite-preview-06-17`)

### OpenAI (GPT)
- ✅ GPT-4.1 (`gpt-4.1`)
- ✅ GPT-4.1-mini (`gpt-4.1-mini`)
- ✅ GPT-4.1-nano (`gpt-4.1-nano`)
- ✅ o3 (`o3`)
- ✅ o4-mini (`o4-mini`)

### Anthropic (Claude)
- ✅ Claude 4 Sonnet (`claude-4-sonnet-20250514`)
- ✅ Claude Haiku 3.5 (`claude-3-5-haiku-20241022`)
- ✅ Claude 4 Opus (`claude-4-opus-20250514`)

### OpenRouter
- ✅ DeepSeek R1 (`deepseek/deepseek-r1-0528:free`)
- ✅ Gemini 2.0 Flash (`google/gemini-2.0-flash-exp:free`)

## 🚀 Deployment

### Production Deployment

1. **Deploy Convex backend:**
   ```bash
   bunx convex deploy --prod
   ```

2. **Set production environment variables:**
   ```bash
   bunx convex env set HOST_GOOGLE_API_KEY your_key_here --prod
   bunx convex env set ANTHROPIC_API_KEY your_key_here --prod
   bunx convex env set OPENAI_API_KEY your_key_here --prod
   bunx convex env set OPENROUTER_API_KEY your_key_here --prod
   bunx convex env set SITE_URL https://your-domain.com --prod
   ```

3. **Deploy frontend** (Vercel recommended):
   - Connect your repository to Vercel
   - Set environment variables:
     ```
     CONVEX_DEPLOYMENT=prod:your-production-deployment
     NEXT_PUBLIC_CONVEX_URL=https://your-production.convex.cloud
     NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://your-auth-domain
     ```
   - Deploy!

### Other Platforms

The frontend can be deployed on platforms supporting Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- Self-hosted with Docker

**Note:** Backend always runs on Convex Cloud for optimal performance.

## 🏗️ Architecture

### Dual Storage System
- **Authenticated Users**: Data stored in Convex database
- **Guest Users**: Data stored in browser memory
- **Seamless Migration**: Guest data can be saved when signing in

### Authentication Flow
1. **Guest Mode**: Immediate access, temporary storage
2. **Google Sign-In**: OAuth flow via custom JWT system
3. **Data Persistence**: Conversations saved to Convex
4. **Cross-Device Sync**: Access chat history anywhere

### API Key Management
```
User API Key → Host API Key → Error Handling
     ↓              ↓              ↓
  Premium        Free Access    Clear Error
   Models         to AI         Message
```

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Use TypeScript for all new code
- Follow the existing code style
- Test both authenticated and guest modes
- Update Convex schema if needed
- Add tests for new features
- Update documentation as needed

## 📝 API Keys & Providers

### Getting API Keys

| Provider | Get API Key | Key Format | Models Available |
|----------|-------------|------------|------------------|
| **Google AI** | [AI Studio](https://aistudio.google.com/apikey) | `AIza...` | Gemini 2.5 Pro/Flash, 2.0 Flash |
| **Anthropic** | [Console](https://console.anthropic.com/settings/keys) | `sk-ant-...` | Claude 4 Sonnet/Opus, Haiku 3.5 |
| **OpenAI** | [Platform](https://platform.openai.com/settings/organization/api-keys) | `sk-...` | GPT-4.1, o3, o4-mini |
| **OpenRouter** | [Dashboard](https://openrouter.ai/keys) | `sk-or-...` | DeepSeek R1, Gemini (free tier) |

### Cost & Rate Limits

- **Host keys:** Shared usage, free for users, managed by host
- **User keys:** Personal quotas, user controls costs and limits
- **Fallback system:** Ensures service availability
- **OpenRouter:** Often includes free tier models

## 🔒 Privacy & Security

### Data Storage
- **Authenticated**: Conversations stored securely in Convex
- **Guest Mode**: Temporary storage in browser memory only
- **No Server Logging**: Host doesn't log conversation contents
- **User Control**: Delete conversations anytime

### API Key Security
- **User Keys**: Encrypted and stored locally in browser
- **Host Keys**: Server-side only, never exposed to client
- **Transmission**: All communications use HTTPS
- **Isolation**: User and host keys kept separate

### Authentication
- **Google OAuth**: Secure authentication flow
- **Custom JWT**: Convex-managed authentication tokens
- **No Password Storage**: OAuth-only authentication
- **Session Management**: Secure token handling

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Convex](https://convex.dev/) for the real-time backend platform
- [Vercel AI SDK](https://sdk.vercel.ai/) for AI provider integration
- [shadcn/ui](https://ui.shadcn.com/) for beautiful UI components
- [Zustand](https://zustand-demo.pmnd.rs/) for state management
- [Next.js](https://nextjs.org/) for the React framework

## 📞 Support

- 🐛 **Bug Reports:** [Open an issue](https://github.com/your-username/chat-studio/issues)
- 💡 **Feature Requests:** [Open an issue](https://github.com/your-username/chat-studio/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/your-username/chat-studio/discussions)
- 📖 **Documentation:** [Convex Setup Guide](./CONVEX_SETUP.md)

---

**Made with ❤️ by Johannes du Plessis**