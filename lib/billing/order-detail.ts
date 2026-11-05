import type {
  BillingOrderKind,
  BillingOrderStatus,
  PayPerBookChapterStatus,
  PayPerBookOrderStatus,
} from "@/generated/prisma";
import { MINUTE_PACKS } from "@/lib/billing/credit-packs";
import { prisma } from "@/lib/db/prisma";

export type BillingOrderDetail = {
  id: string;
  kind: BillingOrderKind;
  itemId: string;
  label: string;
  status: Extract<BillingOrderStatus, "PAID" | "REFUNDED">;
  amountUsd: number;
  premiumSeconds: number;
  creatorPrice: boolean;
  paidAt: string | null;
  createdAt: string;
  pack: { name: string; minutes: number } | null;
  payPerBook: {
    orderId: string;
    status: PayPerBookOrderStatus;
    projectId: string;
    projectTitle: string;
    voiceName: string;
    voiceId: string;
    speed: number;
    billableMinutes: number;
    estimatedMinutes: number;
    selectedWordCount: number;
    chapters: Array<{
      id: string;
      chapterId: string | null;
      title: string;
      wordCount: number;
      status: PayPerBookChapterStatus;
    }>;
  } | null;
};

function orderLabel(kind: BillingOrderKind, itemId: string): string {
  if (kind === "SUBSCRIPTION") {
    return "Creator subscription";
  }
  if (kind === "PAY_PER_BOOK") {
    return "Pay-per-book";
  }
  const pack = MINUTE_PACKS.find((candidate) => candidate.id === itemId);
  return pack ? `${pack.name} pack` : "Minute pack";
}

export async function getBillingOrderDetail(
  userId: string,
  billingOrderId: string,
): Promise<BillingOrderDetail | null> {
  const order = await prisma.billingOrder.findFirst({
    where: {
      id: billingOrderId,
      userId,
      status: { in: ["PAID", "REFUNDED"] },
    },
    include: {
      payPerBookOrder: {
        include: {
          project: { select: { id: true, title: true } },
          chapters: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              chapterId: true,
              title: true,
              wordCount: true,
              status: true,
            },
          },
        },
      },
    },
  });
  if (!order) {
    return null;
  }

  const pack = MINUTE_PACKS.find((candidate) => candidate.id === order.itemId) ?? null;
  const ppb = order.payPerBookOrder;

  return {
    id: order.id,
    kind: order.kind,
    itemId: order.itemId,
    label: orderLabel(order.kind, order.itemId),
    status: order.status === "REFUNDED" ? "REFUNDED" : "PAID",
    amountUsd: Number(order.amountUsd),
    premiumSeconds: order.premiumSeconds,
    creatorPrice: order.creatorPrice,
    paidAt: order.paidAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    pack:
      order.kind === "MINUTE_PACK"
        ? {
            name: pack?.name ?? "Minute pack",
            minutes: Math.round(order.premiumSeconds / 60),
          }
        : null,
    payPerBook: ppb
      ? {
          orderId: ppb.id,
          status: ppb.status,
          projectId: ppb.project.id,
          projectTitle: ppb.project.title,
          voiceName: ppb.voiceName,
          voiceId: ppb.voiceId,
          speed: Number(ppb.speed),
          billableMinutes: ppb.billableMinutes,
          estimatedMinutes: Number(ppb.estimatedMinutes),
          selectedWordCount: ppb.selectedWordCount,
          chapters: ppb.chapters.map((chapter) => ({
            id: chapter.id,
            chapterId: chapter.chapterId,
            title: chapter.title,
            wordCount: chapter.wordCount,
            status: chapter.status,
          })),
        }
      : null,
  };
}
