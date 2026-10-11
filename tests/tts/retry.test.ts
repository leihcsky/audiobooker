import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/api/errors";
import { withTtsRetry } from "@/lib/tts/retry";

const noSleep = (ms: number) => Promise.resolve(void ms);

describe("withTtsRetry", () => {
  it("retries transient provider errors with backoff and jitter", async () => {
    const task = vi
      .fn()
      .mockRejectedValueOnce(new AppError("TTS_PROVIDER_UNAVAILABLE", "down", 503))
      .mockRejectedValueOnce(new AppError("TTS_RATE_LIMITED", "slow down", 429))
      .mockResolvedValue("ok");
    const sleep = vi.fn(noSleep);

    await expect(withTtsRetry(task, { sleep, random: () => 0.5 })).resolves.toBe("ok");
    expect(task).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([1150, 3450]);
  });

  it("does not retry permanent errors", async () => {
    const task = vi.fn().mockRejectedValue(new AppError("TTS_VOICE_NOT_FOUND", "missing", 404));
    await expect(withTtsRetry(task, { sleep: noSleep })).rejects.toMatchObject({
      code: "TTS_VOICE_NOT_FOUND",
    });
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("gives up after the configured attempts", async () => {
    const task = vi.fn().mockRejectedValue(new AppError("TTS_PROVIDER_TIMEOUT", "slow", 504));
    await expect(withTtsRetry(task, { sleep: noSleep })).rejects.toMatchObject({
      code: "TTS_PROVIDER_TIMEOUT",
    });
    expect(task).toHaveBeenCalledTimes(4);
  });

  it("does not retry unknown non-AppError failures", async () => {
    const task = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(withTtsRetry(task, { sleep: noSleep })).rejects.toThrow("boom");
    expect(task).toHaveBeenCalledTimes(1);
  });
});
