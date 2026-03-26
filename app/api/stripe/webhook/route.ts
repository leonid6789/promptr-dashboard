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
        const credits = session.metadata?.credits_to_add ?? "0"
        const amount = ((session.amount_total ?? 0) / 100).toFixed(2)

        await resend.emails.send({
          from: "Promptr <login@leonidemails.site>",
          to: [email],
          subject: "Your Promptr Credits Receipt",
          html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background-color:#18181b;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Promptr</h1>
            <p style="margin:8px 0 0;font-size:14px;color:#a1a1aa;">Payment Receipt</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:#ffffff;padding:40px;">
            <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#27272a;">Thank you for your purchase! Here&rsquo;s a summary of your order.</p>

            <!-- Details Card -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid #e4e4e7;">
                  <p style="margin:0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#71717a;">Credits Purchased</p>
                  <p style="margin:6px 0 0;font-size:28px;font-weight:700;color:#18181b;">${credits}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid #e4e4e7;">
                  <p style="margin:0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#71717a;">Amount Paid</p>
                  <p style="margin:6px 0 0;font-size:28px;font-weight:700;color:#18181b;">$${amount}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#71717a;">Email</p>
                  <p style="margin:6px 0 0;font-size:15px;color:#18181b;">${email}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#ffffff;padding:0 40px 40px;text-align:center;">
            <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 24px;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">If you have any questions, just reply to this email.</p>
            <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;">&copy; ${new Date().getFullYear()} Promptr. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
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
