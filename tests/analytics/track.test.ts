import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "@/lib/analytics/track";

type TestWindow = {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

function stubWindow(initial: TestWindow = {}): TestWindow {
  const target = { ...initial };
  vi.stubGlobal("window", target);
  return target;
}

describe("trackEvent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing on the server", () => {
    expect(() => trackEvent("sign_up", { method: "email" })).not.toThrow();
  });

  it("queues events for GA before the script loads", () => {
    const target = stubWindow();

    trackEvent("tool_upload_completed", { tool: "epub-to-audiobook" });

    expect(target.dataLayer).toHaveLength(1);
    expect(Array.from(target.dataLayer![0] as ArrayLike<unknown>)).toEqual([
      "event",
      "tool_upload_completed",
      { tool: "epub-to-audiobook" },
    ]);
  });

  it("sends purchase revenue to GA", () => {
    const gtag = vi.fn();
    stubWindow({ gtag });

    trackEvent("purchase", { transaction_id: "order-1", item: "book" }, { amount: 99, currency: "USD" });

    expect(gtag).toHaveBeenCalledWith("event", "purchase", {
      transaction_id: "order-1",
      item: "book",
      value: 99,
      currency: "USD",
    });
  });

  it("never throws when an analytics script fails", () => {
    stubWindow({
      gtag: () => {
        throw new Error("blocked");
      },
    });
    expect(() => trackEvent("begin_checkout", { item: "creator" })).not.toThrow();
  });
});
