# Host API Key Setup

This application supports a host Google API key that provides free access to Gemini models for all users.

## Setup Instructions

1. **Create a `.env.local` file** in the root directory of your project
2. **Add your Google API key:**
   ```
   HOST_GOOGLE_API_KEY=your_google_api_key_here
   ```
3. **Restart your development server** for the changes to take effect

## How It Works

- **Free Access**: Users can use Gemini 2.5 Flash and Gemini 2.0 Flash models without providing their own API key
- **User Override**: If users add their own Google API key, it will override the host key for their session
- **Rate Limits**: Users with their own API keys get better rate limits and access to additional models like Gemini 2.5 Pro

## Supported Free Models

When a host Google API key is configured, users get free access to:
- ✅ Gemini 2.5 Flash
- ✅ Gemini 2.0 Flash

## Premium Models (Require User API Key)

The following models require users to provide their own Google API key:
- 🔑 Gemini 2.5 Pro

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HOST_GOOGLE_API_KEY` | Optional | Your Google AI API key for providing free access to Gemini models |

## Getting a Google API Key

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new API key
3. Copy the key (starts with `AIza...`)
4. Add it to your `.env.local` file

## Security Notes

- The host API key is only accessible server-side
- User API keys are stored locally in the browser
- User API keys always take precedence over host keys
- All API communications are encrypted

## Deployment

When deploying to production, set the `HOST_GOOGLE_API_KEY` environment variable in your hosting platform's environment configuration. 