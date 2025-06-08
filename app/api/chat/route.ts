import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { streamText, smoothStream } from "ai"
import { headers } from "next/headers"
import { getModelConfig, type AIModel } from "@/lib/models"
import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { messages, model } = await req.json()
    const headersList = await headers()

    const modelConfig = getModelConfig(model as AIModel)

    const apiKey = headersList.get(modelConfig.headerKey) as string

    let aiModel
    switch (modelConfig.provider) {
      case "google":
        const google = createGoogleGenerativeAI({ apiKey })
        aiModel = google(modelConfig.modelId)
        break

      case "openai":
        const openai = createOpenAI({ apiKey })
        aiModel = openai(modelConfig.modelId)
        break

      case "openrouter":
        const openrouter = createOpenRouter({ apiKey })
        aiModel = openrouter(modelConfig.modelId)
        break

      default:
        return new Response(JSON.stringify({ error: "Unsupported model provider" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
    }

    const result = streamText({
      model: aiModel,
      messages,
      onError: (error) => {
        console.log("error", error)
      },
      system: `
      You are Chat Studio, a knowledgeable AI companion designed to assist users with various questions and tasks.
      
      Your core principles:
      - Provide accurate, helpful responses tailored to each user's needs
      - Maintain a friendly, professional demeanor throughout conversations
      - Foster engaging dialogue while staying focused on being useful
      
      Mathematical Expression Guidelines:
      When working with mathematical content, format expressions using LaTeX notation:
      
      For inline mathematics: Use single dollar signs to wrap expressions like $x^2 + y^2 = z^2$
      For block-level mathematics: Use double dollar signs and place on separate lines
      
      Keep math formatting consistent - avoid mixing different delimiter styles within the same response.
      
      Mathematical formatting examples:
      • Inline usage: "The formula $a^2 + b^2 = c^2$ represents the Pythagorean theorem"
      • Block format:
      $$\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$
      `,
      experimental_transform: [smoothStream({ chunking: "word" })],
      abortSignal: req.signal,
    })

    return result.toDataStreamResponse({
      sendReasoning: true,
      getErrorMessage: (error) => {
        return (error as { message: string }).message
      },
    })
  } catch (error) {
    console.log("error", error)
    return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
