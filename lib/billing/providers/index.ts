import type { BillingProvider } from "@/lib/billing/provider";
import { waffoBillingProvider } from "@/lib/billing/providers/waffo";

export function getBillingProvider(): BillingProvider {
  return waffoBillingProvider;
}
