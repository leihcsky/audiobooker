import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    billingOrder: { findFirst },
  },
}));

import { getBillingOrderDetail } from "@/lib/billing/order-detail";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const orderId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("getBillingOrderDetail", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("returns null when the order is missing or not owned", async () => {
    findFirst.mockResolvedValue(null);
    await expect(getBillingOrderDetail(userId, orderId)).resolves.toBeNull();
  });

  it("maps a pay-per-book order with project and chapters", async () => {
    findFirst.mockResolvedValue({
      id: orderId,
      kind: "PAY_PER_BOOK",
      itemId: "pay_per_book",
      status: "PAID",
      amountUsd: 12.5,
      premiumSeconds: 0,
      creatorPrice: false,
      paidAt: new Date("2026-11-01T00:00:00.000Z"),
      createdAt: new Date("2026-11-01T00:00:00.000Z"),
      payPerBookOrder: {
        id: "ppb-1",
        status: "COMPLETED",
        voiceName: "Wise Woman",
        voiceId: "replicate-wise-woman",
        speed: 1,
        billableMinutes: 15,
        estimatedMinutes: 14.2,
        selectedWordCount: 3200,
        project: { id: "proj-1", title: "The Quiet River" },
        chapters: [
          {
            id: "oc-1",
            chapterId: "ch-1",
            title: "Chapter 1",
            wordCount: 1600,
            status: "COMPLETED",
          },
        ],
      },
    });

    const detail = await getBillingOrderDetail(userId, orderId);

    expect(detail).toMatchObject({
      id: orderId,
      kind: "PAY_PER_BOOK",
      label: "Pay-per-book",
      status: "PAID",
      amountUsd: 12.5,
      payPerBook: {
        projectTitle: "The Quiet River",
        billableMinutes: 15,
        voiceName: "Wise Woman",
        chapters: [{ title: "Chapter 1", status: "COMPLETED" }],
      },
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: orderId, userId }),
      }),
    );
  });

  it("maps a minute pack without pay-per-book data", async () => {
    findFirst.mockResolvedValue({
      id: orderId,
      kind: "MINUTE_PACK",
      itemId: "book",
      status: "PAID",
      amountUsd: 99,
      premiumSeconds: 36_000,
      creatorPrice: true,
      paidAt: new Date("2026-11-02T00:00:00.000Z"),
      createdAt: new Date("2026-11-02T00:00:00.000Z"),
      payPerBookOrder: null,
    });

    const detail = await getBillingOrderDetail(userId, orderId);

    expect(detail).toMatchObject({
      label: "Book pack",
      pack: { name: "Book", minutes: 600 },
      payPerBook: null,
    });
  });
});
