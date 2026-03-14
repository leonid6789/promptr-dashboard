import { createClient } from "@/lib/supabase/server"
import { SignInScreen } from "@/components/sign-in-screen"
import { PromtprDashboard } from "@/components/promptr-dashboard"

export default async function Page() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <SignInScreen />
  }

  await supabase
    .from("UsersTBL")
    .upsert({ id: user.id, credits: 20 }, { onConflict: "id", ignoreDuplicates: true })

  return <PromtprDashboard />
}