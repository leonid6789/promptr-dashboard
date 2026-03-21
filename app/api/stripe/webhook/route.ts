import { NextResponse } from "next/server"
import Stripe from "stripe"
import { supabaseAdmin } from "@/lib/supabase/admin"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get("Stripe-Signature")

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe-Signature header" },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown verification error"
    console.error("Webhook signature verification failed:", message)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    )
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.user_id
    const creditsRaw = session.metadata?.credits_to_add

    if (!userId || !creditsRaw) {
      console.error("Missing metadata on checkout session:", session.id)
      return NextResponse.json(
        { error: "Missing user_id or credits_to_add in session metadata" },
        { status: 400 }
      )
    }

    const creditsToAdd = Number(creditsRaw)
    if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
      console.error("Invalid credits_to_add value:", creditsRaw)
      return NextResponse.json(
        { error: "credits_to_add must be a positive number" },
        { status: 400 }
      )
    }

    const { data: user, error: fetchError } = await supabaseAdmin
      .from("UsersTBL")
      .select("credits")
      .eq("id", userId)
      .single()

    if (fetchError || !user) {
      console.error("Failed to fetch user:", fetchError?.message)
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    const newCredits = (user.credits ?? 0) + creditsToAdd

    const { error: updateError } = await supabaseAdmin
      .from("UsersTBL")
      .update({ credits: newCredits })
      .eq("id", userId)

    if (updateError) {
      console.error("Failed to update credits:", updateError.message)
      return NextResponse.json(
        { error: "Failed to update user credits" },
        { status: 500 }
      )
    }

    console.log(
      `Added ${creditsToAdd} credits to user ${userId} (new total: ${newCredits})`
    )
  }

  return NextResponse.json({ received: true })
}
