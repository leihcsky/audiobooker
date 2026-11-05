"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SubscriptionState = {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  status: string;
};

type ApiResponse =
  | { success: true; data: SubscriptionState }
  | { success: false; error: { code: string; message: string } };

export function SubscriptionActions({
  cancelAtPeriodEnd,
  pastDue,
}: {
  cancelAtPeriodEnd: boolean;
  pastDue: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"cancel" | "resume" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "cancel" | "resume") {
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/billing/subscription/${action}`, { method: "POST" });
      if (response.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent("/studio/billing")}`);
        return;
      }
      const body = (await response.json()) as ApiResponse;
      if (!body.success) {
        setError(body.error.message);
        setPending(null);
        return;
      }
      router.refresh();
      setPending(null);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      setPending(null);
    }
  }

  return (
    <div className="space-y-2">
      {cancelAtPeriodEnd ? (
        <Button
          type="button"
          className="w-full"
          disabled={pending !== null}
          onClick={() => void run("resume")}
        >
          {pending === "resume" ? "Resuming…" : "Resume subscription"}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending !== null}
          onClick={() => void run("cancel")}
        >
          {pending === "cancel" ? "Canceling…" : pastDue ? "Cancel subscription" : "Cancel renewal"}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
