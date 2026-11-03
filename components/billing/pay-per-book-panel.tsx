"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PayPerBookQuoteDto } from "@/lib/billing/pay-per-book-shared";
import { formatSpokenLength } from "@/lib/tts/narration-length";

type PayPerBookPanelProps = {
  projectId: string;
  chapterIds: string[];
  voiceId: string;
  speed: number;
  /** When set, quote only these chapters (regen after edit/voice change). */
  regenerateChapterIds?: string[];
  /** Total included chapters in the project selection (for scope copy). */
  selectedChapterCount?: number;
  disabled?: boolean;
};

export function PayPerBookPanel({
  projectId,
  chapterIds,
  voiceId,
  speed,
  regenerateChapterIds,
  selectedChapterCount,
  disabled,
}: PayPerBookPanelProps) {
  const [quote, setQuote] = useState<PayPerBookQuoteDto | null>(null);
  const [pending, setPending] = useState<"quote" | "checkout" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targets = regenerateChapterIds?.length ? regenerateChapterIds : chapterIds;
  const regenerating = Boolean(regenerateChapterIds?.length);
  const requestKey = `${projectId}:${voiceId}:${speed}:${targets.join(",")}:${regenerating ? "regen" : "new"}`;
  const lastQuotedKey = useRef<string | null>(null);

  async function createQuote(force = false) {
    if (!voiceId || targets.length === 0) {
      return;
    }
    if (!force && lastQuotedKey.current === requestKey && quote) {
      return;
    }
    setPending("quote");
    setError(null);
    try {
      const path = regenerating ? "/api/pay-per-book/regenerate-quote" : "/api/pay-per-book/quote";
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, chapterIds: targets, voiceId, speed }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { quote?: PayPerBookQuoteDto };
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.data?.quote) {
        setQuote(null);
        setError(payload?.error?.message ?? "We couldn't create a quote.");
        return;
      }
      lastQuotedKey.current = requestKey;
      setQuote(payload.data.quote);
    } catch {
      setQuote(null);
      setError("We couldn't create a quote.");
    } finally {
      setPending(null);
    }
  }

  useEffect(() => {
    if (disabled || !voiceId || targets.length === 0) {
      return;
    }
    if (lastQuotedKey.current === requestKey) {
      return;
    }
    void createQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quote when selection/voice/speed key changes
  }, [requestKey, disabled]);

  async function checkout() {
    if (!quote) {
      return;
    }
    setPending("checkout");
    setError(null);
    try {
      const response = await fetch("/api/pay-per-book/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { checkoutUrl?: string };
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.data?.checkoutUrl) {
        setError(payload?.error?.message ?? "Checkout isn't available right now.");
        return;
      }
      window.location.href = payload.data.checkoutUrl;
    } catch {
      setError("Checkout isn't available right now.");
      setPending(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-700/30 bg-amber-50/60 p-4 text-sm">
      <div>
        <p className="font-medium text-foreground">
          {regenerating ? "Pay to regenerate selected chapters" : "Pay-per-Book (Premium voice)"}
        </p>
        <p className="mt-1 text-muted-foreground">
          One-time payment for {targets.length} chapter{targets.length === 1 ? "" : "s"}. Does not use
          Premium Minutes.
        </p>
      </div>

      {pending === "quote" && !quote ? (
        <p className="text-muted-foreground">Estimating price…</p>
      ) : null}

      {quote ? (
        <div className="space-y-1 text-foreground">
          <p>
            {quote.selectedChapterIds.length} chapter
            {quote.selectedChapterIds.length === 1 ? "" : "s"}
            <span className="text-muted-foreground"> · </span>
            {quote.selectedWordCount.toLocaleString("en-US")} words
            <span className="text-muted-foreground"> · </span>
            about {formatSpokenLength(quote.estimatedSeconds)}
          </p>
          <p className="text-lg font-semibold">
            ${quote.totalAmount.toFixed(2)} {quote.currency}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedChapterCount != null && selectedChapterCount > quote.selectedChapterIds.length
              ? `Length is for the ${quote.selectedChapterIds.length} chapters in this payment, not every selected chapter.`
              : "Length uses the same timing as Selected for the audiobook above."}{" "}
            One-time price. Quote expires {new Date(quote.expiresAt).toLocaleString()}.{" "}
            <Link href="/pricing" className="underline">
              Pricing details
            </Link>
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void createQuote(true)}
          disabled={disabled || !voiceId || targets.length === 0 || pending !== null}
        >
          {pending === "quote" ? "Quoting..." : quote ? "Refresh quote" : "Get quote"}
        </Button>
        {quote ? (
          <Button size="sm" onClick={() => void checkout()} disabled={disabled || pending !== null}>
            {pending === "checkout" ? "Redirecting..." : "Pay and generate"}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
