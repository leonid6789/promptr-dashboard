"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function PromtprDashboard() {
  const [prompt, setPrompt] = useState("")
  const [credits, setCredits] = useState<number>(0)
  const [improvedPrompt, setImprovedPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCredits = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from("UsersTBL")
        .select("credits")
        .eq("id", user.id)
        .single()
      setCredits(data?.credits ?? 0)
    }
    fetchCredits()
  }, [])

  const handleGenerate = async () => {
    if (credits <= 0) return
    setGenerateError(null)
    setIsGenerating(true)
    try {
      const res = await fetch("/api/improve-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGenerateError(data.error ?? "Something went wrong")
        return
      }
      setImprovedPrompt(data.improvedPrompt ?? "")
      if (typeof data.credits === "number") setCredits(data.credits)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLogout = async () => {
    await createClient().auth.signOut()
    window.location.href = "/"
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-black">Promptr</h1>

        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white px-4 py-2 text-sm text-black shadow-sm ring-1 ring-gray-200">
            {credits} Credits Remaining
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="rounded-lg border-gray-200 bg-white text-black hover:bg-gray-50"
          >
            Log out
          </Button>
          <Button className="rounded-lg bg-black text-white hover:bg-black/90">
            Upgrade
          </Button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex flex-1 gap-4 p-6">
        {/* Left Panel */}
        <div className="relative flex flex-1 flex-col rounded-xl bg-gray-50 ring-1 ring-gray-200">
          <Textarea
            placeholder="Describe your UI component here"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 resize-none border-0 bg-transparent p-4 text-base focus-visible:ring-0"
          />
          <div className="p-4 pt-0">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || credits <= 0}
              className="ml-auto block rounded-lg bg-black px-6 text-white hover:bg-black/90 disabled:opacity-50"
            >
              {isGenerating ? "Generating…" : "Generate"}
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-gray-200" />

        {/* Right Panel */}
        <div className="flex flex-1 flex-col rounded-xl bg-gray-50 ring-1 ring-gray-200 p-4">
          {generateError && (
            <p className="mb-2 text-sm text-red-600">{generateError}</p>
          )}
          {improvedPrompt ? (
            <p className="flex-1 whitespace-pre-wrap text-base text-black">
              {improvedPrompt}
            </p>
          ) : (
            <p className="flex-1 text-base text-gray-500">
              {isGenerating
                ? "Improving your prompt…"
                : "Improved prompt will appear here."}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
