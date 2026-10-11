import { createHash } from "node:crypto";
import { TTS_SETTINGS } from "@/lib/config/limits";
import { prisma } from "@/lib/db/prisma";
import { getStorage } from "@/lib/storage";

export type TtsCacheKeyInput = {
  provider: string;
  providerModel: string;
  providerVoiceId: string;
  language: string;
  speed: number;
  pitch: string;
  volume: string;
  text: string;
};

export type TtsCacheKey = {
  cacheKey: string;
  textHash: string;
};

export type CachedAudio = {
  audio: Buffer;
  durationSeconds: number | null;
};

export const DEFAULT_PITCH = "+0Hz";
export const DEFAULT_VOLUME = "+0%";

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function buildTtsCacheKey(input: TtsCacheKeyInput): TtsCacheKey {
  const textHash = hashText(input.text);
  const canonical = JSON.stringify([
    "v1",
    input.provider,
    input.providerModel,
    input.providerVoiceId,
    input.language.toLowerCase(),
    input.speed.toFixed(2),
    input.pitch,
    input.volume,
    textHash,
  ]);
  return { cacheKey: createHash("sha256").update(canonical, "utf8").digest("hex"), textHash };
}

export function ttsCacheObjectKey(cacheKey: string): string {
  return `tts-cache/${cacheKey}.mp3`;
}

/** Cache lookups never fail a generation; any error is treated as a miss. */
export async function readTtsCache(cacheKey: string): Promise<CachedAudio | null> {
  try {
    const entry = await prisma.ttsCacheEntry.findUnique({ where: { cacheKey } });
    if (!entry) {
      return null;
    }
    let audio: Buffer;
    try {
      audio = await getStorage().getObject(entry.objectKey);
    } catch {
      await prisma.ttsCacheEntry.delete({ where: { cacheKey } }).catch(() => undefined);
      return null;
    }
    if (audio.length === 0) {
      return null;
    }
    void prisma.ttsCacheEntry
      .update({
        where: { cacheKey },
        data: { hitCount: { increment: 1 }, lastUsedAt: new Date() },
      })
      .catch(() => undefined);
    return {
      audio,
      durationSeconds: entry.durationSeconds == null ? null : Number(entry.durationSeconds),
    };
  } catch (error) {
    console.info("tts_cache_read_failed", { message: errorMessage(error) });
    return null;
  }
}

export async function writeTtsCache(input: {
  key: TtsCacheKey;
  provider: string;
  providerModel: string;
  providerVoiceId: string;
  characters: number;
  audio: Buffer;
  durationSeconds: number | null;
}): Promise<void> {
  const objectKey = ttsCacheObjectKey(input.key.cacheKey);
  try {
    await getStorage().putObject({ objectKey, body: input.audio, contentType: "audio/mpeg" });
    await prisma.ttsCacheEntry.upsert({
      where: { cacheKey: input.key.cacheKey },
      create: {
        cacheKey: input.key.cacheKey,
        provider: input.provider,
        providerModel: input.providerModel,
        providerVoiceId: input.providerVoiceId,
        textHash: input.key.textHash,
        characters: input.characters,
        objectKey,
        sizeBytes: input.audio.length,
        durationSeconds: input.durationSeconds,
      },
      update: { lastUsedAt: new Date() },
    });
  } catch (error) {
    console.info("tts_cache_write_failed", { message: errorMessage(error) });
  }
}

export async function pruneTtsCache(now = new Date(), batchSize = 200): Promise<number> {
  const cutoff = new Date(now.getTime() - TTS_SETTINGS.CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let removed = 0;
  for (;;) {
    const stale = await prisma.ttsCacheEntry.findMany({
      where: { lastUsedAt: { lt: cutoff } },
      select: { id: true, objectKey: true },
      take: batchSize,
    });
    if (stale.length === 0) {
      return removed;
    }
    for (const entry of stale) {
      await getStorage()
        .deleteObject(entry.objectKey)
        .catch(() => undefined);
    }
    await prisma.ttsCacheEntry.deleteMany({ where: { id: { in: stale.map((entry) => entry.id) } } });
    removed += stale.length;
    if (stale.length < batchSize) {
      return removed;
    }
  }
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}
