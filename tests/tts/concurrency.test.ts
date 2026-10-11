import { describe, expect, it } from "vitest";
import { withProviderSlot } from "@/lib/tts/concurrency";

describe("withProviderSlot", () => {
  it("never runs more than the configured number of calls at once", async () => {
    let active = 0;
    let peak = 0;
    const task = async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    };

    await Promise.all(Array.from({ length: 8 }, () => withProviderSlot("test-provider", 2, task)));
    expect(peak).toBe(2);
  });

  it("releases the slot when a call fails", async () => {
    await expect(
      withProviderSlot("failing-provider", 1, () => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
    await expect(withProviderSlot("failing-provider", 1, () => Promise.resolve("ok"))).resolves.toBe("ok");
  });
});
