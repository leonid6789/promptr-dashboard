import { NextResponse } from "next/server"
import Stripe from "stripe"
import { Resend } from "resend"
import { supabaseAdmin } from "@/lib/supabase/admin"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY!)

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
    const eventId = event.id
    console.log(`Processing checkout.session.completed: ${eventId}`)

    const { error: insertEventError } = await supabaseAdmin
      .from("StripeEventsTBL")
      .insert({ id: eventId })

    if (insertEventError) {
      console.log(`Duplicate Stripe event ${eventId}, skipping`)
      return NextResponse.json({ received: true })
    }

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

    const { error: purchaseError } = await supabaseAdmin
      .from("PurchasesTBL")
      .insert({
        user_id: userId,
        stripe_event_id: eventId,
        stripe_session_id: session.id,
        credits: creditsToAdd,
        amount_total: session.amount_total,
        currency: session.currency,
        customer_email: session.customer_details?.email || null,
      })

    if (purchaseError) {
      console.error("Failed to record purchase:", purchaseError.message)
    } else {
      console.log("Purchase recorded:", session.id)
    }

    const email = session.customer_details?.email
    if (email) {
      try {
        await resend.emails.send({
          from: "Promptr <login@leonidemails.site>",
          to: [email],
          subject: "Your Promptr Credits Receipt",
          html: `
            <h2>Thank you for your purchase!</h2>
            <p>You have successfully purchased <strong>${session.metadata?.credits_to_add ?? "0"} credits</strong>.</p>
            <p>Amount Paid: $${((session.amount_total ?? 0) / 100).toFixed(2)}</p>
            <p>If you have any questions, just reply to this email.</p>
          `,
        })
        console.log("Receipt email sent to:", email)
      } catch (emailError) {
        console.error(
          "Failed to send receipt email:",
          emailError instanceof Error ? emailError.message : emailError
        )
      }
    }
  }

  return NextResponse.json({ received: true })
}
