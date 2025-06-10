import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { getHostAPIKey } from "@/lib/host-config"

export async function POST(req: Request) {
  const headersList = await headers()
  const userGoogleApiKey = headersList.get("X-Google-API-Key")

  // Try user key first, then fallback to host key
  let googleApiKey = userGoogleApiKey
  if (!googleApiKey) {
    googleApiKey = getHostAPIKey("google")
  }

  if (!googleApiKey) {
    return NextResponse.json(
      {
        error: "Google API key is required to enable chat title generation.",
      },
      { status: 400 },
    )
  }

  const google = createGoogleGenerativeAI({
    apiKey: googleApiKey,
  })

  const { prompt, isTitle, messageId, threadId } = await req.json()

  try {
    const { text: title } = await generateText({
      model: google("gemini-2.0-flash-exp"),
      system: `\n
      - you will generate a short title based on the first message a user begins a conversation with
      - ensure it is not more than 80 characters long
      - the title should be a summary of the user's message
      - you should NOT answer the user's message, you should only generate a summary/title
      - do not use quotes or colons`,
      prompt,
    })

    return NextResponse.json({ title, isTitle, messageId, threadId })
  } catch (error) {
    console.error("Failed to generate title:", error)
    return NextResponse.json({ error: "Failed to generate title" }, { status: 500 })
  }
}
