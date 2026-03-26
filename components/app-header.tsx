"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Clock3, Receipt } from "lucide-react"

const CREDIT_PACKS: { credits: number; priceLabel: string }[] = [
  { credits: 100, priceLabel: "$5" },
  { credits: 500, priceLabel: "$15" },
  { credits: 2000, priceLabel: "$39" },
]

/** Prevents duplicate checkout-return handling when React Strict Mode runs effects twice. */
let stripeCheckoutReturnHandling = false

type PurchaseItem = {
  id: string
  credits: number
  amount_total: number
  currency: string
  created_at: string
  stripe_session_id: string | null
}

type AppHeaderProps = {
  credits: number
  onCreditsRefresh: () => void
}

export function AppHeader({ credits, onCreditsRefresh }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [purchases, setPurchases] = useState<PurchaseItem[]>([])
  const [purchaseHistoryOpen, setPurchaseHistoryOpen] = useState(false)
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false)
  const [buyingPack, setBuyingPack] = useState<number | null>(null)

  const fetchPurchases = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("PurchasesTBL")
      .select("id, credits, amount_total, currency, created_at, stripe_session_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    setPurchases(data ?? [])
  }, [])

  useEffect(() => {
    fetchPurchases()
  }, [fetchPurchases])

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const checkoutStatus = params.get("checkout")
    if (checkoutStatus !== "success" && checkoutStatus !== "cancelled") return
    if (stripeCheckoutReturnHandling) return
    stripeCheckoutReturnHandling = true

    const clearCheckoutFromUrl = () => {
      const nextParams = new URLSearchParams(window.location.search)
      if (!nextParams.has("checkout")) return
      nextParams.delete("checkout")
      const rest = nextParams.toString()
      router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false })
    }

    if (checkoutStatus === "success") {
      void (async () => {
        try {
          onCreditsRefresh()
          await fetchPurchases()
          toast.success("Credits added successfully")
          clearCheckoutFromUrl()
        } finally {
          stripeCheckoutReturnHandling = false
        }
      })()
    } else {
      try {
        toast("Checkout cancelled")
        clearCheckoutFromUrl()
      } finally {
        stripeCheckoutReturnHandling = false
      }
    }
  }, [fetchPurchases, onCreditsRefresh, pathname, router])

  const handleLogout = async () => {
    await createClient().auth.signOut()
    window.location.href = "/"
  }

  const handleBuyCredits = async (pack: number) => {
    setBuyingPack(pack)
    let redirecting = false
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to start checkout")
        return
      }
      if (data.url) {
        redirecting = true
        window.location.href = data.url
        return
      }
    } catch {
      toast.error("Failed to start checkout")
    } finally {
      if (!redirecting) {
        setBuyingPack(null)
      }
    }
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <Link href="/" className="text-xl font-bold text-black hover:opacity-80 transition-opacity">
          Promptr
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/history"
            aria-current={pathname === "/history" ? "page" : undefined}
            className={
              pathname === "/history"
                ? "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-gray-100 text-black shadow-sm"
                : "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 active:scale-95"
            }
            title="Prompt History"
          >
            <Clock3 className="h-4 w-4" />
          </Link>
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
          <button
            type="button"
            onClick={() => setPurchaseHistoryOpen(true)}
            disabled={purchases.length === 0}
            title={purchases.length === 0 ? "No purchase history yet" : "Purchase History"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-200 disabled:active:scale-100"
          >
            <Receipt className="h-4 w-4" />
          </button>
          <Button
            type="button"
            onClick={() => setBuyCreditsOpen(true)}
            className="rounded-lg bg-black text-white hover:bg-black/90"
          >
            Buy Credits
          </Button>
        </div>
      </header>

      <Dialog open={buyCreditsOpen} onOpenChange={setBuyCreditsOpen}>
        <DialogContent className="border-gray-200 bg-white text-black sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-black">Buy credits</DialogTitle>
            <DialogDescription className="text-gray-600">
              Choose a pack. You will be redirected to Stripe Checkout to
              complete payment.
            </DialogDescription>
          </DialogHeader>
          <ul className="grid gap-3">
            {CREDIT_PACKS.map(({ credits: packCredits, priceLabel }) => (
              <li
                key={packCredits}
                className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3 ring-1 ring-gray-200"
              >
                <div className="min-w-0">
                  <p className="font-medium text-black">
                    {packCredits.toLocaleString()} credits
                  </p>
                  <p className="text-sm text-gray-600">{priceLabel}</p>
                </div>
                <Button
                  type="button"
                  onClick={() => handleBuyCredits(packCredits)}
                  disabled={buyingPack !== null}
                  className="shrink-0 rounded-lg bg-black text-white hover:bg-black/90 disabled:opacity-50"
                >
                  {buyingPack === packCredits ? "Redirecting…" : "Purchase"}
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={purchaseHistoryOpen} onOpenChange={setPurchaseHistoryOpen}>
        <DialogContent className="border-gray-200 bg-white text-black sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-black">Purchase History</DialogTitle>
            <DialogDescription className="text-gray-600">
              Your credit purchases and payment receipts.
            </DialogDescription>
          </DialogHeader>
          {purchases.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Your purchase history will appear here.
            </p>
          ) : (
            <div className="max-h-80 overflow-auto rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Credits</th>
                    <th className="px-4 py-2.5">Amount</th>
                    <th className="px-4 py-2.5">Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-black">
                        +{p.credits.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        ${((p.amount_total ?? 0) / 100).toFixed(2)}{" "}
                        {p.currency?.toUpperCase()}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-400">
                        {p.stripe_session_id
                          ? `…${p.stripe_session_id.slice(-6)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
