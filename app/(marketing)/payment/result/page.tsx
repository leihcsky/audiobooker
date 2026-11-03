import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getPayPerBookOrderForUser } from "@/lib/billing/pay-per-book.service";
import { AppError } from "@/lib/api/errors";
import { PaymentResultClient } from "@/components/billing/payment-result-client";

export const metadata: Metadata = {
  title: "Payment result — Audiobooker",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ order?: string | string[] }>;
};

export default async function PaymentResultPage({ searchParams }: PageProps) {
  const user = await requireSession();
  const { order: raw } = await searchParams;
  const orderId = typeof raw === "string" ? raw : null;

  if (!orderId) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="font-serif text-3xl tracking-tight">Payment result</h1>
        <p className="mt-3 text-muted-foreground">Missing order reference.</p>
        <Link href="/studio/projects" className="mt-6 inline-block underline">
          Back to projects
        </Link>
      </main>
    );
  }

  let initial = null;
  try {
    initial = await getPayPerBookOrderForUser(orderId, user.id);
  } catch (error) {
    if (!(error instanceof AppError && error.code === "ORDER_NOT_FOUND")) {
      throw error;
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-serif text-3xl tracking-tight">Payment result</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Payment is confirmed by our billing webhook. This page only shows status.
      </p>
      <div className="mt-8">
        <PaymentResultClient billingOrderId={orderId} initial={initial} />
      </div>
    </main>
  );
}
