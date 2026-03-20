"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type HistoryItem = {
  id: string
  original_prompt: string
  improved_prompt: string
  created_at: string
}

type SpeechRecognitionResult = {
  0: {
    transcript: string
  }
  isFinal: boolean
}

type SpeechRecognitionResultEvent = {
  results: ArrayLike<SpeechRecognitionResult>
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: (() => void) | null
  onstart: (() => void) | null
  onend: (() => void) | null
}

type BrowserSpeechRecognitionConstructor = new () => SpeechRecognitionInstance

export function PromtprDashboard() {
  const [prompt, setPrompt] = useState("")
  const [credits, setCredits] = useState<number>(0)
  const [improvedPrompt, setImprovedPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const sessionFinalTranscriptRef = useRef("")

  const fetchHistory = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("PromptsTBL")
      .select("id, original_prompt, improved_prompt, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
    setHistory(data ?? [])
  }, [])

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
    fetchHistory()
  }, [fetchHistory])

  useEffect(() => {
    if (typeof window === "undefined") return

    const browserWindow = window as unknown as {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
    }

    const SpeechRecognitionConstructor =
      browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition

    if (!SpeechRecognitionConstructor) {
      setIsSpeechSupported(false)
      return
    }

    setIsSpeechSupported(true)

    const recognition = new SpeechRecognitionConstructor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const results = Array.from(event.results)

      const finalText = results
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim()

      const interimText = results
        .filter((result) => !result.isFinal)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim()

      if (finalText) {
        sessionFinalTranscriptRef.current = finalText
      }

      setInterimTranscript(interimText)
    }

    recognition.onerror = () => {
      setSpeechError("There was a problem with speech recognition. Please try again.")
      setIsListening(false)
    }

    recognition.onstart = () => {
      setSpeechError(null)
      setIsListening(true)
      setInterimTranscript("")
      sessionFinalTranscriptRef.current = ""
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimTranscript("")

      const finalText = sessionFinalTranscriptRef.current.trim()
      if (finalText) {
        setPrompt((prev) => {
          if (!prev) return finalText
          const needsSpace = !prev.endsWith(" ")
          return `${prev}${needsSpace ? " " : ""}${finalText}`
        })
      }

      sessionFinalTranscriptRef.current = ""
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [])

  const handleToggleListening = () => {
    if (!isSpeechSupported) {
      setSpeechError(
        "Speech recognition is not supported in this browser. Please try a different browser."
      )
      return
    }

    if (!recognitionRef.current) {
      setSpeechError("Speech recognition is not available right now. Please try again.")
      return
    }

    setSpeechError(null)

    if (isListening) {
      recognitionRef.current.stop()
    } else {
      recognitionRef.current.start()
    }
  }

  const handleGenerate = async () => {
    if (credits <= 0) return
    setGenerateError(null)
    setImprovedPrompt("")
    setIsGenerating(true)
    try {
      const res = await fetch("/api/improve-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setGenerateError(data.error ?? "Something went wrong")
        return
      }

      if (!res.body) {
        setGenerateError("No response from server")
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let done = false

      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        if (!value) continue

        const chunkText = decoder.decode(value, { stream: !done })
        const lines = chunkText.split("\n").filter((line) => line.trim().length > 0)

        for (const line of lines) {
          try {
            const payload = JSON.parse(line) as {
              type: "chunk" | "done" | "error"
              text?: string
              fullText?: string
              credits?: number
              error?: string
            }

            if (payload.type === "chunk" && payload.text) {
              setImprovedPrompt((prev) => prev + payload.text)
            } else if (payload.type === "done") {
              if (typeof payload.credits === "number") {
                setCredits(payload.credits)
              }
              fetchHistory()
            } else if (payload.type === "error") {
              setGenerateError(payload.error ?? "Something went wrong")
            }
          } catch {
            // Ignore malformed JSON chunks
          }
        }
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLogout = async () => {
    await createClient().auth.signOut()
    window.location.href = "/"
  }

  const handleCopyImprovedPrompt = async () => {
    if (!improvedPrompt) return
    if (!navigator?.clipboard?.writeText) return

    try {
      await navigator.clipboard.writeText(improvedPrompt)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 1500)
    } catch {
      // silently fail if clipboard is unavailable
    }
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
          <div className="flex items-center justify-end gap-2 p-4 pt-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleToggleListening}
              disabled={!isSpeechSupported}
              className="rounded-lg border-gray-200 bg-white text-sm text-black hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isListening ? "Listening…" : "Speak"}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || credits <= 0}
              className="rounded-lg bg-black px-6 text-white hover:bg-black/90 disabled:opacity-50"
            >
              {isGenerating ? "Generating…" : "Generate"}
            </Button>
          </div>
          {isListening && (
            <p className="px-4 text-xs text-gray-500">
              {interimTranscript || "Listening… speak now."}
            </p>
          )}
          {speechError && (
            <p className="px-4 pb-4 text-xs text-red-600">{speechError}</p>
          )}
        </div>

        {/* Divider */}
        <div className="w-px bg-gray-200" />

        {/* Right Panel */}
        <div className="flex flex-1 flex-col rounded-xl bg-gray-50 ring-1 ring-gray-200 p-4">
          {improvedPrompt && (
            <div className="mb-2 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyImprovedPrompt}
                className="rounded-lg border-gray-200 bg-white px-3 py-1 text-xs text-black hover:bg-gray-50"
              >
                {isCopied ? "Copied!" : "Copy"}
              </Button>
            </div>
          )}
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

      {/* Prompt History */}
      {history.length > 0 && (
        <section className="px-6 pb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Recent History
          </h2>
          <div className="space-y-1">
            {history.map((item) => {
              const isExpanded = expandedIds.has(item.id)
              return (
                <div
                  key={item.id}
                  className="rounded-lg bg-white ring-1 ring-gray-200"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(item.id)) next.delete(item.id)
                        else next.add(item.id)
                        return next
                      })
                    }
                    className="flex w-full items-center gap-3 px-3 py-2 text-left"
                  >
                    <svg
                      className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="shrink-0 text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                    <span className="shrink-0 text-xs font-medium uppercase text-gray-400">
                      Original
                    </span>
                    <span className="truncate text-sm text-gray-700">
                      {item.original_prompt}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-3 pb-3 pt-2">
                      <p className="mb-1 text-xs font-medium uppercase text-gray-400">
                        Improved
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-gray-900">
                        {item.improved_prompt}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
