/**
 * Browser-side conversion events, sent to Google Analytics and Plausible.
 * Never pass personal data (emails, book titles, file names) as params.
 */

export type AnalyticsEventName =
  | "tool_upload_completed"
  | "tool_generate_started"
  | "tool_download"
  | "tool_signup_clicked"
  | "sign_up"
  | "begin_checkout"
  | "purchase";

export type AnalyticsParams = Record<string, string | number>;

export type AnalyticsRevenue = { amount: number; currency: string };

type QueueFunction = ((...args: unknown[]) => void) & { q?: unknown[] };

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  plausible?: QueueFunction;
};

/** Same queue stubs as the vendor snippets, so events sent before the scripts load are not lost. */
function analyticsWindow(): AnalyticsWindow | null {
  if (typeof window === "undefined") {
    return null;
  }
  const target = window as AnalyticsWindow;
  target.dataLayer = target.dataLayer ?? [];
  target.gtag =
    target.gtag ??
    function gtag() {
      // gtag.js only reads the `arguments` object, not an array.
      // eslint-disable-next-line prefer-rest-params
      target.dataLayer?.push(arguments);
    };
  if (!target.plausible) {
    const queue: QueueFunction = (...args: unknown[]) => {
      (queue.q = queue.q ?? []).push(args);
    };
    target.plausible = queue;
  }
  return target;
}

export function trackEvent(name: AnalyticsEventName, params: AnalyticsParams = {}, revenue?: AnalyticsRevenue): void {
  const target = analyticsWindow();
  if (!target) {
    return;
  }
  try {
    target.gtag?.("event", name, revenue ? { ...params, value: revenue.amount, currency: revenue.currency } : params);
    target.plausible?.(name, revenue ? { props: params, revenue } : { props: params });
  } catch {
    // Analytics must never break the page.
  }
}
