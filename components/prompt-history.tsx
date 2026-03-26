"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { AppHeader } from "@/components/app-header"
import { ArrowLeft } from "lucide-react"

type HistoryItem = {
  id: string
  original_prompt: string
  improved_prompt: string
  created_at: string
}

export function PromptHistory() {
  const [credits, setCredits] = useState<number>(0)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  const fetchCredits = useCallback(async () => {
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
  }, [])

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
    setHistory(data ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchCredits()
    fetchHistory()
  }, [fetchCredits, fetchHistory])

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <AppHeader credits={credits} onCreditsRefresh={fetchCredits} />

      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-95"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h2 className="text-lg font-semibold text-black">Prompt History</h2>
        </div>
      </div>

      <main className="flex-1 px-6 pb-6 pt-4">
        {isLoading ? (
          <p className="py-16 text-center text-sm text-gray-400">
            Loading history…
          </p>
        ) : history.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">
            Your prompt history will appear here.
          </p>
        ) : (
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
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
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
                    <span className="truncate text-sm text-gray-700">
                      {item.original_prompt}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-3 pb-3 pt-2">
                      <div className="mb-2">
                        <p className="mb-0.5 text-xs font-medium uppercase text-gray-400">
                          Original
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-gray-700">
                          {item.original_prompt}
                        </p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs font-medium uppercase text-gray-400">
                          Improved
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-gray-900">
                          {item.improved_prompt}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
