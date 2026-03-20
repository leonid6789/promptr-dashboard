"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { createClient } from "@/lib/supabase/client"

export function SignInScreen() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmed = email.trim()
    if (!trimmed) {
      toast.error("Please enter your email address.")
      return
    }

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      toast.error(error.message)
      return
    }

    setSentEmail(trimmed)
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="w-full max-w-sm px-6 text-center">
          <h1 className="mb-4 text-3xl font-bold text-black">
            Check your inbox
          </h1>
          <p className="text-gray-600">
            We sent a sign-in link to{" "}
            <span className="font-medium text-black">{sentEmail}</span>.
            <br />
            Click the link to continue.
          </p>
          <p className="mt-4 text-sm text-gray-400">
            {"Don't see it? Check your spam or junk folder."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm px-6">
        <h1 className="mb-8 text-center text-3xl font-bold text-black">
          Sign in to Promptr
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Field>
            <FieldLabel className="text-sm text-black">Email</FieldLabel>
            <Input
              type="email"
              placeholder="username@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border-gray-300 bg-white"
            />
          </Field>

          <Button
            type="submit"
            className="w-full rounded-lg bg-black py-6 text-white hover:bg-black/90"
          >
            Continue with email
          </Button>
        </form>
      </div>
    </div>
  )
}