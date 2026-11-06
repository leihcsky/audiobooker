import { randomUUID } from "node:crypto";
import type { PayPerBookOrder, Prisma } from "@/generated/prisma";
import {
  AppError,
  billingUnavailable,
  checkoutRateLimited,
  conflict,
  ttsInvalidRequest,
  validationError,
} from "@/lib/api/errors";
import { PAY_PER_BOOK_CONFIG } from "@/lib/billing/pay-per-book-config";
import { calculatePayPerBookPrice } from "@/lib/billing/pay-per-book-pricing";
import type { PayPerBookOrderDto, PayPerBookQuoteDto } from "@/lib/billing/pay-per-book-shared";
import { assertProjectWithinPlan, getVoiceAccess } from "@/lib/billing/entitlements";
import { getBillingProvider } from "@/lib/billing/providers";
import { getSiteUrl } from "@/lib/tools/site";
import { recordToolEvent } from "@/lib/tools/events";
import { prisma } from "@/lib/db/prisma";
import { scheduleProjectGeneration } from "@/lib/jobs/schedule-tts";
import { countWords } from "@/lib/parser/normalize";
import { assertProjectAccess } from "@/lib/tools/access";
import { resolveVoice } from "@/lib/tts";
import { hashText } from "@/lib/tts/cache";
import { estimateNarrationSeconds } from "@/lib/tts/narration-length";
import { effectiveSpeechSpeed, normalizeSpeechSpeed } from "@/lib/tts/speed";
import { assertPremiumBatchCostGuard } from "@/lib/usage/usage.service";

export type { PayPerBookOrderDto, PayPerBookQuoteDto } from "@/lib/billing/pay-per-book-shared";

const MAX_CHECKOUTS_PER_HOUR = 10;

type QuoteChapter = {
  id: string;
  title: string;
  sourceText: string;
  wordCount: number;
  characterCount: number;
  textHash: string;
  /** Same rule as bookStats: real audio length when present, else text estimate. */
  durationSeconds: number;
};

function asStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function asHashMap(value: Prisma.JsonValue): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      out[key] = entry;
    }
  }
  return out;
}

function toQuoteDto(
  row: {
    id: string;
    projectId: string;
    selectedChapterIds: Prisma.JsonValue;
    selectedWordCount: number;
    estimatedMinutes: Prisma.Decimal | number;
    billableMinutes: number;
    pricePerMinute: Prisma.Decimal | number;
    totalAmount: Prisma.Decimal | number;
    currency: string;
    provider: string;
    voiceId: string;
    voiceName: string;
    speed: Prisma.Decimal | number;
    expiresAt: Date;
    createdAt: Date;
  },
  estimatedSeconds: number,
): PayPerBookQuoteDto {
  return {
    id: row.id,
    projectId: row.projectId,
    selectedChapterIds: asStringArray(row.selectedChapterIds),
    selectedWordCount: row.selectedWordCount,
    estimatedMinutes: Number(row.estimatedMinutes),
    estimatedSeconds,
    billableMinutes: row.billableMinutes,
    pricePerMinute: Number(row.pricePerMinute),
    totalAmount: Number(row.totalAmount),
    currency: row.currency,
    provider: row.provider,
    voiceId: row.voiceId,
    voiceName: row.voiceName,
    speed: Number(row.speed),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadQuoteChapters(
  projectId: string,
  chapterIds: string[],
): Promise<QuoteChapter[]> {
  if (chapterIds.length === 0) {
    throw validationError("Select at least one chapter.");
  }
  const unique = [...new Set(chapterIds)];
  const chapters = await prisma.chapter.findMany({
    where: { projectId, id: { in: unique } },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      sourceText: true,
      currentAudioFile: { select: { durationSeconds: true } },
    },
  });
  if (chapters.length !== unique.length) {
    throw validationError("One or more chapters are not part of this project.");
  }
  const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  return unique.map((id) => {
    const chapter = byId.get(id)!;
    const sourceText = chapter.sourceText;
    const wordCount = countWords(sourceText);
    if (wordCount < 1) {
      throw validationError(`“${chapter.title}” has no billable text.`);
    }
    const audioSeconds =
      chapter.currentAudioFile?.durationSeconds == null
        ? null
        : Number(chapter.currentAudioFile.durationSeconds);
    return {
      id: chapter.id,
      title: chapter.title,
      sourceText,
      wordCount,
      characterCount: sourceText.length,
      textHash: hashText(sourceText),
      durationSeconds: audioSeconds ?? estimateNarrationSeconds(sourceText),
    };
  });
}

export async function createPayPerBookQuote(input: {
  userId: string;
  projectId: string;
  chapterIds: string[];
  voiceId: string;
  speed?: number;
}): Promise<PayPerBookQuoteDto> {
  await assertProjectAccess({ type: "user", userId: input.userId }, input.projectId);
  await assertProjectWithinPlan({ type: "user", userId: input.userId }, input.projectId);

  const { voice, provider } = resolveVoice(await getVoiceAccess({ type: "user", userId: input.userId }), input.voiceId);
  if (voice.tier !== "premium") {
    throw ttsInvalidRequest("Pay-per-Book is only available for Premium voices.");
  }

  const chapters = await loadQuoteChapters(input.projectId, input.chapterIds);
  const selectedWordCount = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
  // Match Chapters → “Selected for the audiobook” (audio duration when present).
  const estimatedSeconds = chapters.reduce((sum, chapter) => sum + chapter.durationSeconds, 0);
  const price = calculatePayPerBookPrice({ selectedWordCount, estimatedSeconds });
  if (price.billableMinutes < 1 || price.totalAmount <= 0) {
    throw validationError("Select chapters with enough text to create an order.");
  }

  const speed = effectiveSpeechSpeed(input.speed, voice.supportsSpeed);
  const expiresAt = new Date(Date.now() + PAY_PER_BOOK_CONFIG.quoteTtlMinutes * 60_000);
  const chapterHashes = Object.fromEntries(chapters.map((chapter) => [chapter.id, chapter.textHash]));

  const created = await prisma.payPerBookQuote.create({
    data: {
      userId: input.userId,
      projectId: input.projectId,
      selectedChapterIds: chapters.map((chapter) => chapter.id),
      selectedWordCount: price.selectedWordCount,
      estimatedMinutes: price.estimatedMinutes,
      billableMinutes: price.billableMinutes,
      pricePerMinute: price.pricePerMinute,
      totalAmount: price.totalAmount,
      currency: price.currency,
      provider: provider.id,
      voiceId: voice.id,
      voiceName: voice.name,
      speed,
      chapterHashes,
      expiresAt,
    },
  });

  await recordToolEvent({
    actor: { type: "user", userId: input.userId },
    projectId: input.projectId,
    name: "quote_created",
    metadata: {
      quoteId: created.id,
      billableMinutes: price.billableMinutes,
      totalAmount: price.totalAmount,
      voiceId: voice.id,
      chapterCount: chapters.length,
    },
  });

  return toQuoteDto(created, estimatedSeconds);
}

/** Alias used when regenerating changed chapters — same pricing path. */
export const createPayPerBookRegenerateQuote = createPayPerBookQuote;

export async function createPayPerBookCheckout(input: {
  userId: string;
  email: string | null;
  quoteId: string;
}): Promise<{ checkoutUrl: string; billingOrderId: string }> {
  const provider = getBillingProvider();
  if (!provider.isConfigured()) {
    throw billingUnavailable();
  }
  const productId = provider.productIdFor("pay_per_book", false);
  if (!productId) {
    throw billingUnavailable();
  }

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.billingOrder.count({
    where: { userId: input.userId, createdAt: { gte: since } },
  });
  if (recent >= MAX_CHECKOUTS_PER_HOUR) {
    throw checkoutRateLimited();
  }

  const quote = await prisma.payPerBookQuote.findUnique({ where: { id: input.quoteId } });
  if (!quote || quote.userId !== input.userId) {
    throw new AppError("QUOTE_NOT_FOUND", "This quote was not found.", 404);
  }
  if (quote.expiresAt.getTime() <= Date.now()) {
    throw validationError("This quote has expired. Create a new quote.");
  }

  await assertProjectAccess({ type: "user", userId: input.userId }, quote.projectId);

  const chapterIds = asStringArray(quote.selectedChapterIds);
  const chapters = await loadQuoteChapters(quote.projectId, chapterIds);
  const expectedHashes = asHashMap(quote.chapterHashes);
  for (const chapter of chapters) {
    if (expectedHashes[chapter.id] !== chapter.textHash) {
      throw conflict("Chapter text changed since this quote. Create a new quote.");
    }
  }

  const { voice } = resolveVoice(
    await getVoiceAccess({ type: "user", userId: input.userId }),
    quote.voiceId,
  );
  if (voice.tier !== "premium" || voice.id !== quote.voiceId) {
    throw conflict("The quoted Premium voice is no longer available. Create a new quote.");
  }

  const pending = await prisma.payPerBookOrder.findFirst({
    where: {
      userId: input.userId,
      projectId: quote.projectId,
      status: "PENDING_PAYMENT",
      billingOrder: { status: "PENDING" },
    },
    include: { billingOrder: true },
    orderBy: { createdAt: "desc" },
  });
  if (pending?.billingOrder.checkoutSessionId) {
    // Allow a fresh checkout; leave the old pending order orphaned.
  }

  const amountUsd = Number(quote.totalAmount);
  const billingOrderId = randomUUID();
  const ppbOrderId = randomUUID();
  const successUrl = `${getSiteUrl()}/payment/result?order=${billingOrderId}`;

  await prisma.$transaction(async (tx) => {
    await tx.billingOrder.create({
      data: {
        id: billingOrderId,
        userId: input.userId,
        provider: provider.id,
        kind: "PAY_PER_BOOK",
        itemId: PAY_PER_BOOK_CONFIG.itemId,
        creatorPrice: false,
        productId,
        amountUsd,
        premiumSeconds: 0,
        projectId: quote.projectId,
        status: "PENDING",
      },
    });
    await tx.payPerBookOrder.create({
      data: {
        id: ppbOrderId,
        billingOrderId,
        quoteId: quote.id,
        userId: input.userId,
        projectId: quote.projectId,
        selectedWordCount: quote.selectedWordCount,
        estimatedMinutes: quote.estimatedMinutes,
        billableMinutes: quote.billableMinutes,
        pricePerMinute: quote.pricePerMinute,
        totalAmount: quote.totalAmount,
        currency: quote.currency,
        provider: quote.provider,
        voiceId: quote.voiceId,
        voiceName: quote.voiceName,
        speed: quote.speed,
        status: "PENDING_PAYMENT",
        chapters: {
          create: chapters.map((chapter) => ({
            chapterId: chapter.id,
            title: chapter.title,
            wordCount: chapter.wordCount,
            characterCount: chapter.characterCount,
            textHash: chapter.textHash,
            sourceText: chapter.sourceText,
            voiceId: voice.id,
            status: "PENDING",
          })),
        },
      },
    });
  });

  try {
    const session = await provider.createCheckout({
      item: "pay_per_book",
      productId,
      userId: input.userId,
      email: input.email,
      reference: billingOrderId,
      successUrl,
      expiresInSeconds: 3600,
      priceSnapshot: { amountUsd, taxCategory: "digital_goods" },
    });
    await prisma.billingOrder.update({
      where: { id: billingOrderId },
      data: { checkoutSessionId: session.sessionId },
    });
    await recordToolEvent({
      actor: { type: "user", userId: input.userId },
      projectId: quote.projectId,
      name: "checkout_started",
      metadata: {
        billingOrderId,
        quoteId: quote.id,
        itemId: PAY_PER_BOOK_CONFIG.itemId,
        kind: "PAY_PER_BOOK",
        amountUsd,
      },
    });
    return { checkoutUrl: session.checkoutUrl, billingOrderId };
  } catch (error) {
    await prisma.payPerBookOrder.update({
      where: { id: ppbOrderId },
      data: { status: "CANCELLED" },
    });
    console.error("pay_per_book_checkout_failed", {
      billingOrderId,
      message: error instanceof Error ? error.message : String(error),
    });
    await recordToolEvent({
      actor: { type: "user", userId: input.userId },
      projectId: quote.projectId,
      name: "checkout_failed",
      metadata: {
        billingOrderId,
        quoteId: quote.id,
        itemId: PAY_PER_BOOK_CONFIG.itemId,
        kind: "PAY_PER_BOOK",
        stage: "provider_create",
      },
    });
    throw billingUnavailable();
  }
}

export async function getPayPerBookOrderForUser(
  billingOrderId: string,
  userId: string,
): Promise<PayPerBookOrderDto> {
  const order = await prisma.payPerBookOrder.findUnique({
    where: { billingOrderId },
    include: {
      chapters: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order || order.userId !== userId) {
    throw new AppError("ORDER_NOT_FOUND", "This order was not found.", 404);
  }
  return {
    id: order.id,
    billingOrderId: order.billingOrderId,
    projectId: order.projectId,
    status: order.status,
    totalAmount: Number(order.totalAmount),
    currency: order.currency,
    billableMinutes: order.billableMinutes,
    voiceId: order.voiceId,
    voiceName: order.voiceName,
    speed: Number(order.speed),
    paidAt: order.paidAt?.toISOString() ?? null,
    generationJobId: order.generationJobId,
    chapters: order.chapters.map((chapter) => ({
      id: chapter.id,
      chapterId: chapter.chapterId,
      title: chapter.title,
      wordCount: chapter.wordCount,
      status: chapter.status,
    })),
  };
}

export async function markPayPerBookPaid(
  tx: Prisma.TransactionClient,
  billingOrderId: string,
): Promise<PayPerBookOrder | null> {
  const order = await tx.payPerBookOrder.findUnique({ where: { billingOrderId } });
  if (!order) {
    return null;
  }
  if (order.status === "PENDING_PAYMENT") {
    return tx.payPerBookOrder.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date() },
    });
  }
  return order;
}

export async function markPayPerBookRefunded(
  tx: Prisma.TransactionClient,
  billingOrderId: string,
): Promise<void> {
  await tx.payPerBookOrder.updateMany({
    where: { billingOrderId, status: { not: "REFUNDED" } },
    data: { status: "REFUNDED" },
  });
}

/**
 * Starts Premium TTS for a paid Pay-per-Book order without reserving minutes.
 * Idempotent: returns early when generation is already linked or running.
 */
export async function startPayPerBookGeneration(billingOrderId: string): Promise<void> {
  const order = await prisma.payPerBookOrder.findUnique({
    where: { billingOrderId },
    include: { chapters: true, billingOrder: true },
  });
  if (!order || order.billingOrder.status !== "PAID") {
    return;
  }
  if (order.status === "GENERATING" || order.status === "COMPLETED" || order.status === "PARTIALLY_COMPLETED") {
    if (order.generationJobId) {
      scheduleProjectGeneration(order.generationJobId);
    }
    return;
  }
  if (order.status !== "PAID" && order.status !== "FAILED") {
    return;
  }

  const actor = { type: "user" as const, userId: order.userId };
  const { voice, provider } = resolveVoice(await getVoiceAccess(actor), order.voiceId);
  if (voice.tier !== "premium") {
    throw ttsInvalidRequest("Pay-per-Book fulfilment requires a Premium voice.");
  }

  const chapterIds = order.chapters
    .map((chapter) => chapter.chapterId)
    .filter((id): id is string => Boolean(id));
  if (chapterIds.length === 0) {
    await prisma.payPerBookOrder.update({
      where: { id: order.id },
      data: { status: "FAILED" },
    });
    return;
  }

  const chapters = await prisma.chapter.findMany({
    where: { id: { in: chapterIds }, projectId: order.projectId },
    orderBy: { orderIndex: "asc" },
    select: { id: true, characterCount: true, sourceText: true },
  });
  if (chapters.length === 0) {
    await prisma.payPerBookOrder.update({
      where: { id: order.id },
      data: { status: "FAILED" },
    });
    return;
  }

  const active = await prisma.generationJob.findFirst({
    where: {
      projectId: order.projectId,
      type: "GENERATE_PROJECT",
      status: { in: ["QUEUED", "PROCESSING"] },
    },
  });
  if (active) {
    if (active.payPerBookOrderId === order.id) {
      scheduleProjectGeneration(active.id);
    }
    return;
  }

  const totalCharacters = chapters.reduce((sum, chapter) => sum + chapter.sourceText.length, 0);
  const billedCharacters = chapters.map((chapter) => provider.billableCharacters(chapter.sourceText));
  const estimates = billedCharacters.map((characters) =>
    provider.estimateCost({ characters, purpose: "generate" }),
  );
  await assertPremiumBatchCostGuard(estimates.map((estimate) => estimate.estimatedCost));

  const parentId = randomUUID();
  const childIds = chapters.map(() => randomUUID());
  const speed = normalizeSpeechSpeed(Number(order.speed));

  await prisma.$transaction(
    async (tx) => {
      await tx.generationJob.create({
        data: {
          id: parentId,
          projectId: order.projectId,
          type: "GENERATE_PROJECT",
          status: "QUEUED",
          provider: provider.id,
          providerModel: estimates[0]?.model,
          voiceId: voice.id,
          billingSource: "PAY_PER_BOOK",
          payPerBookOrderId: order.id,
          inputCharacters: totalCharacters,
          totalChunks: chapters.length,
        },
      });
      await tx.generationJob.createMany({
        data: chapters.map((chapter, index) => ({
          id: childIds[index],
          projectId: order.projectId,
          chapterId: chapter.id,
          parentJobId: parentId,
          type: "GENERATE_TTS" as const,
          status: "QUEUED" as const,
          provider: provider.id,
          providerModel: estimates[index].model,
          tier: "PREMIUM" as const,
          voiceId: voice.id,
          billingSource: "PAY_PER_BOOK" as const,
          payPerBookOrderId: order.id,
          inputCharacters: chapter.sourceText.length,
          estimatedCost: estimates[index].estimatedCost,
          currency: estimates[index].currency,
        })),
      });
      await tx.chapter.updateMany({
        where: { id: { in: chapters.map((chapter) => chapter.id) } },
        data: { selectedVoiceId: voice.id, selectedSpeed: speed, included: true },
      });
      for (const [index, chapter] of chapters.entries()) {
        await tx.payPerBookOrderChapter.updateMany({
          where: { orderId: order.id, chapterId: chapter.id },
          data: { status: "QUEUED", generationJobId: childIds[index] },
        });
      }
      await tx.payPerBookOrder.update({
        where: { id: order.id },
        data: { status: "GENERATING", generationJobId: parentId },
      });
    },
    { timeout: 20_000 },
  );

  scheduleProjectGeneration(parentId);
}

export async function syncPayPerBookOrderFromJob(parentJobId: string): Promise<void> {
  const parent = await prisma.generationJob.findUnique({
    where: { id: parentJobId },
    select: {
      id: true,
      status: true,
      payPerBookOrderId: true,
      completedChunks: true,
      totalChunks: true,
      childJobs: { select: { id: true, chapterId: true, status: true } },
    },
  });
  if (!parent?.payPerBookOrderId) {
    return;
  }

  const orderId = parent.payPerBookOrderId;
  for (const child of parent.childJobs) {
    if (!child.chapterId) {
      continue;
    }
    const chapter = await prisma.chapter.findUnique({
      where: { id: child.chapterId },
      select: { currentAudioFileId: true },
    });
    const status =
      child.status === "COMPLETED"
        ? "COMPLETED"
        : child.status === "FAILED" || child.status === "CANCELLED"
          ? "FAILED"
          : child.status === "PROCESSING"
            ? "GENERATING"
            : "QUEUED";
    await prisma.payPerBookOrderChapter.updateMany({
      where: { orderId, chapterId: child.chapterId },
      data: {
        status,
        generationJobId: child.id,
        ...(chapter?.currentAudioFileId ? { audioFileId: chapter.currentAudioFileId } : {}),
      },
    });
  }

  if (parent.status === "COMPLETED") {
    await prisma.payPerBookOrder.update({
      where: { id: orderId },
      data: { status: "COMPLETED" },
    });
    return;
  }
  if (parent.status === "FAILED" || parent.status === "CANCELLED") {
    const chapters = await prisma.payPerBookOrderChapter.findMany({
      where: { orderId },
      select: { status: true },
    });
    const anyDone = chapters.some((chapter) => chapter.status === "COMPLETED");
    await prisma.payPerBookOrder.update({
      where: { id: orderId },
      data: { status: anyDone ? "PARTIALLY_COMPLETED" : "FAILED" },
    });
  }
}
