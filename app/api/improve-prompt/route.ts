import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { data: userRow } = await supabase
      .from("UsersTBL")
      .select("credits")
      .eq("id", user.id)
      .single()

    const credits = userRow?.credits ?? 0
    if (credits <= 0) {
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 }
      )
    }

    const body = await request.json()
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : ""
    if (!prompt) {
      return NextResponse.json(
        { error: "Missing or invalid prompt" },
        { status: 400 }
      )
    }

    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      temperature: 0.7,
      system:
        "You are an AI assistant specialized in improving user prompts for other AI systems.\n\nYour goal is to take the user's original prompt and rewrite it to make it clearer, more detailed, and more likely to get high-quality results.\n\n- Do not change the meaning or intention of the original prompt.\n- Provide a concise improved version, and optionally, a brief explanation of what you changed and why.\n- Do not comment on What Changed & Why. Just write the improved prompt with no other comment.\n- Try to not exceed 800 tokens.",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }],
        },
      ],
      thinking: { type: "disabled" },
    })

    const encoder = new TextEncoder()
    let fullText = ""

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta" &&
              typeof event.delta.text === "string"
            ) {
              const chunk = event.delta.text
              fullText += chunk
              const payload = JSON.stringify({
                type: "chunk",
                text: chunk,
              })
              controller.enqueue(encoder.encode(`${payload}\n`))
            }
          }

          const { error: decrementError } = await supabase.rpc(
            "decrement_credits",
            {
              amount: 1,
            }
          )

          let updatedCredits = credits

          if (decrementError) {
            console.error("decrement_credits failed:", decrementError)
          } else {
            const { data: updated } = await supabase
              .from("UsersTBL")
              .select("credits")
              .eq("id", user.id)
              .single()
            updatedCredits = updated?.credits ?? credits - 1

            await supabase.from("PromptsTBL").insert({
              user_id: user.id,
              original_prompt: prompt,
              improved_prompt: fullText.trim(),
            })
          }

          const finalPayload = JSON.stringify({
            type: "done",
            fullText: fullText.trim(),
            credits: updatedCredits,
          })
          controller.enqueue(encoder.encode(`${finalPayload}\n`))
          controller.close()
        } catch (err) {
          console.error("improve-prompt stream error:", err)
          const errorPayload = JSON.stringify({
            type: "error",
            error: "Failed to improve prompt",
          })
          controller.enqueue(encoder.encode(`${errorPayload}\n`))
          controller.close()
        } finally {
          // Allow the underlying SDK to clean up the stream internally
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    })
  } catch (err) {
    console.error("improve-prompt error:", err)
    return NextResponse.json(
      { error: "Failed to improve prompt" },
      { status: 500 }
    )
  }
}
