"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { createClient } from "@/lib/supabase/client"

export function SignInScreen() {
  const [email, setEmail] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      console.error("Login error:", error.message)
      return
    }

    alert("Check your email for the login link!")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm px-6">
        <h1 className="mb-8 text-center text-3xl font-bold text-black">
          Sign-In/Sign-Up
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Field>
            <FieldLabel className="text-sm text-black">Email</FieldLabel>
            <Input
              type="email"
              placeholder="Kole@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border-gray-300 bg-white"
            />
          </Field>

          <Button
            type="submit"
            className="w-full rounded-lg bg-black py-6 text-white hover:bg-black/90"
          >
            {"Let's go!"}
          </Button>
        </form>
      </div>
    </div>
  )
}