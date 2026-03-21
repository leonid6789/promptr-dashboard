import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_MAP: Record<number, string | undefined> = {
  100: process.env.STRIPE_PRICE_100,
  500: process.env.STRIPE_PRICE_500,
  2000: process.env.STRIPE_PRICE_2000,
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const pack = typeof body?.pack === "number" ? body.pack : null

    if (!pack || !PRICE_MAP[pack]) {
      return NextResponse.json(
        { error: "Invalid credit pack. Choose 100, 500, or 2000." },
        { status: 400 }
      )
    }

    const priceId = PRICE_MAP[pack]!
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}?checkout=success`,
      cancel_url: `${appUrl}?checkout=cancelled`,
      metadata: {
        user_id: user.id,
        credits_to_add: String(pack),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("create-checkout-session error:", err)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}
