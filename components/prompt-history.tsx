"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { AppHeader } from "@/components/app-header"
import { ArrowLeft, Check, Copy, Search, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  const filteredHistory = useMemo(() => {
    const query = search.toLowerCase().trim()
    if (!query) return history
    return history.filter(
      (item) =>
        item.original_prompt.toLowerCase().includes(query) ||
        item.improved_prompt.toLowerCase().includes(query)
    )
  }, [history, search])

  const allVisibleSelected =
    filteredHistory.length > 0 &&
    filteredHistory.every((item) => selectedIds.has(item.id))

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const item of filteredHistory) next.delete(item.id)
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const item of filteredHistory) next.add(item.id)
        return next
      })
    }
  }

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    try {
      const supabase = createClient()
      const idsToDelete = Array.from(selectedIds)
      const { error } = await supabase
        .from("PromptsTBL")
        .delete()
        .in("id", idsToDelete)

      if (error) {
        console.error("Failed to delete prompts:", error)
        return
      }

      setHistory((prev) => prev.filter((item) => !selectedIds.has(item.id)))
      setExpandedIds((prev) => {
        const next = new Set(prev)
        for (const id of idsToDelete) next.delete(id)
        return next
      })
      setSelectedIds(new Set())
      setShowDeleteDialog(false)
    } finally {
      setIsDeleting(false)
    }
  }

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

        {!isLoading && history.length > 0 && (
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompt history…"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-black placeholder:text-gray-400 shadow-sm outline-none transition-colors focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
            />
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="mx-6 mt-2 flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm">
          <span className="text-sm text-gray-700">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
          <Button
            type="button"
            onClick={handleDeleteSelected}
            disabled={isDeleting}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      )}

      <main className="flex-1 px-6 pb-6 pt-4">
        {isLoading ? (
          <p className="py-16 text-center text-sm text-gray-400">
            Loading history…
          </p>
        ) : history.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">
            Your prompt history will appear here.
          </p>
        ) : filteredHistory.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">
            No prompts match your search.
          </p>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-3 pb-1">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-black accent-black"
              />
              <span className="text-xs text-gray-400">Select all</span>
            </div>

            {filteredHistory.map((item) => {
              const isExpanded = expandedIds.has(item.id)
              const isSelected = selectedIds.has(item.id)
              return (
                <div
                  key={item.id}
                  className={`rounded-lg bg-white ring-1 ${isSelected ? "ring-gray-400" : "ring-gray-200"}`}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-gray-300 text-black accent-black"
                    />
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
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-3 pb-3 pt-2">
                      <div className="mb-2">
                        <div className="mb-0.5 flex items-center justify-between">
                          <p className="text-xs font-medium uppercase text-gray-400">
                            Original
                          </p>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.original_prompt, `${item.id}:original`)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                          >
                            {copiedKey === `${item.id}:original` ? (
                              <><Check className="h-3 w-3" /> Copied!</>
                            ) : (
                              <><Copy className="h-3 w-3" /> Copy</>
                            )}
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-gray-700">
                          {item.original_prompt}
                        </p>
                      </div>
                      <div>
                        <div className="mb-0.5 flex items-center justify-between">
                          <p className="text-xs font-medium uppercase text-gray-400">
                            Improved
                          </p>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.improved_prompt, `${item.id}:improved`)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                          >
                            {copiedKey === `${item.id}:improved` ? (
                              <><Check className="h-3 w-3" /> Copied!</>
                            ) : (
                              <><Copy className="h-3 w-3" /> Copy</>
                            )}
                          </button>
                        </div>
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

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="border-gray-200 bg-white text-black sm:max-w-md translate-y-0">
          <DialogHeader>
            <DialogTitle className="text-black">Delete History</DialogTitle>
            <DialogDescription className="text-gray-600">
              Are you sure you want to delete {selectedIds.size} selected prompt
              {selectedIds.size > 1 ? "s" : ""}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="rounded-lg border-gray-200 bg-white text-black hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="rounded-lg"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
