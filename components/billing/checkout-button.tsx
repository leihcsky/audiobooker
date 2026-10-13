"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { BillingItemId } from "@/lib/billing/provider";
import { cn } from "@/lib/utils";

type CheckoutResponse =
  | { success: true; data: { checkoutUrl: string } }
  | { success: false; error: { code: string; message: string } };

export function CheckoutButton({
  item,
  children,
  variant,
  className,
}: {
  item: BillingItemId;
  children: React.ReactNode;
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
      });
      if (response.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const body = (await response.json()) as CheckoutResponse;
      if (!body.success) {
        setError(body.error.message);
        setPending(false);
        return;
      }
      window.location.assign(body.data.checkoutUrl);
    } catch {
      setError("Couldn't open checkout. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <div className="w-full">
      <Button
        variant={variant}
        className={cn("w-full", className)}
        disabled={pending}
        onClick={startCheckout}
      >
        {pending ? "Opening checkout…" : children}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
