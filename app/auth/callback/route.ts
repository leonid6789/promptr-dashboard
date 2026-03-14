import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from("UsersTBL")
        .upsert({ id: user.id, credits: 20 }, { onConflict: "id", ignoreDuplicates: true })
    }
  }

  return NextResponse.redirect(`${origin}/`)
}