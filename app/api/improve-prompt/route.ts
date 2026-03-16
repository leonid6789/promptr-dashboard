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

    const msg = await anthropic.messages.create({
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

    const textBlock = msg.content.find(
      (block): block is { type: "text"; text: string } => block.type === "text"
    )
    const improvedPrompt = textBlock?.text?.trim() ?? ""

    const { error: decrementError } = await supabase.rpc("decrement_credits", {
      amount: 1,
    })
    if (decrementError) {
      console.error("decrement_credits failed:", decrementError)
      return NextResponse.json(
        { error: "Failed to deduct credit" },
        { status: 500 }
      )
    }

    const { data: updated } = await supabase
      .from("UsersTBL")
      .select("credits")
      .eq("id", user.id)
      .single()

    return NextResponse.json({
      improvedPrompt,
      credits: updated?.credits ?? credits - 1,
    })
  } catch (err) {
    console.error("improve-prompt error:", err)
    return NextResponse.json(
      { error: "Failed to improve prompt" },
      { status: 500 }
    )
  }
}
