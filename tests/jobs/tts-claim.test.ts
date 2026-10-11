import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    generationJob: { updateMany },
  },
}));

import { claimTtsJob, TTS_STALE_PROCESSING_MS } from "@/lib/jobs/tts-claim";

describe("claimTtsJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims a queued job", async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(claimTtsJob("job-1")).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1", type: "GENERATE_TTS", status: "QUEUED" },
      }),
    );
  });

  it("does not steal a fresh processing job", async () => {
    updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });
    await expect(claimTtsJob("job-1")).resolves.toBe(false);
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PROCESSING",
          updatedAt: { lt: expect.any(Date) },
        }),
      }),
    );
    const staleBefore = updateMany.mock.calls[1][0].where.updatedAt.lt as Date;
    expect(Date.now() - staleBefore.getTime()).toBeGreaterThan(TTS_STALE_PROCESSING_MS - 1000);
  });
});
