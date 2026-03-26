import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PromptHistory } from "@/components/prompt-history"

export default async function HistoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  return <PromptHistory />
}
