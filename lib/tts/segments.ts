import { z } from "zod";
import { applyPronunciationsToChunks, type PronunciationRule } from "@/lib/pronunciation/apply";
import { buildTtsCacheKey, DEFAULT_PITCH, DEFAULT_VOLUME } from "@/lib/tts/cache";
import { chunkText } from "@/lib/tts/chunking";
import { estimateMp3DurationSeconds, stripId3 } from "@/lib/tts/mp3";
import type { TextChunk, TTSProvider, VoiceDefinition } from "@/lib/tts/types";

export type PlannedChunk = TextChunk & { cacheKey: string; textHash: string };

export type AudioSegment = {
  paragraph: number;
  cacheKey: string;
  start: number;
  duration: number;
  offset: number;
  length: number;
};

export type SegmentManifest = {
  version: 1;
  voiceId: string;
  speed: number;
  segments: AudioSegment[];
};

const segmentSchema = z.object({
  paragraph: z.number().int().min(0),
  cacheKey: z.string().min(1),
  start: z.number().min(0),
  duration: z.number().min(0),
  offset: z.number().int().min(0),
  length: z.number().int().min(1),
});

const manifestSchema = z.object({
  version: z.literal(1),
  voiceId: z.string().min(1),
  speed: z.number().positive(),
  segments: z.array(segmentSchema),
});

export function parseSegmentManifest(value: unknown): SegmentManifest | null {
  const parsed = manifestSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The chunks a chapter is synthesized from, with the cache key each chunk's audio is stored under. */
export function planChapterChunks(input: {
  text: string;
  provider: TTSProvider;
  voice: VoiceDefinition;
  speed: number;
  rules: PronunciationRule[];
}): PlannedChunk[] {
  const options = {
    maxCharacters: input.provider.limits.targetCharacters,
    maxBytes: input.provider.limits.maxBytes,
  };
  const model = input.provider.modelFor("generate");
  return applyPronunciationsToChunks(chunkText(input.text, options), input.rules, options).map((chunk) => {
    const key = buildTtsCacheKey({
      provider: input.provider.id,
      providerModel: model,
      providerVoiceId: input.voice.providerVoiceId,
      language: input.voice.languageCode,
      speed: input.speed,
      pitch: DEFAULT_PITCH,
      volume: DEFAULT_VOLUME,
      text: chunk.text,
    });
    return { ...chunk, cacheKey: key.cacheKey, textHash: key.textHash };
  });
}

const roundMs = (seconds: number) => Math.round(seconds * 1000) / 1000;

/** Joins per-chunk MP3s and records where each one sits in the result. */
export function assembleSegments(
  parts: { paragraph: number; cacheKey: string; audio: Buffer }[],
  meta: { voiceId: string; speed: number },
): { audio: Buffer; manifest: SegmentManifest } {
  if (parts.length === 0) {
    throw new Error("No audio chunks to assemble.");
  }
  const segments: AudioSegment[] = [];
  const buffers: Buffer[] = [];
  let offset = 0;
  let start = 0;
  for (const part of parts) {
    const audio = stripId3(part.audio);
    const duration = estimateMp3DurationSeconds(audio) ?? 0;
    segments.push({
      paragraph: part.paragraph,
      cacheKey: part.cacheKey,
      start: roundMs(start),
      duration: roundMs(duration),
      offset,
      length: audio.length,
    });
    buffers.push(audio);
    offset += audio.length;
    start += duration;
  }
  return {
    audio: Buffer.concat(buffers),
    manifest: { version: 1, voiceId: meta.voiceId, speed: meta.speed, segments },
  };
}

/** Segment audio by cache key, copied out of a stored chapter MP3. Out-of-range segments are skipped. */
export function sliceSegments(audio: Buffer, manifest: SegmentManifest): Map<string, Buffer> {
  const slices = new Map<string, Buffer>();
  for (const segment of manifest.segments) {
    const end = segment.offset + segment.length;
    if (end <= audio.length && !slices.has(segment.cacheKey)) {
      slices.set(segment.cacheKey, Buffer.from(audio.subarray(segment.offset, end)));
    }
  }
  return slices;
}

/**
 * Pairs planned chunks with manifest segments in order, so a paragraph that
 * moved because another was inserted or removed still finds its audio.
 */
export function matchSegments(chunks: PlannedChunk[], manifest: SegmentManifest): (AudioSegment | null)[] {
  let cursor = 0;
  return chunks.map((chunk) => {
    for (let index = cursor; index < manifest.segments.length; index += 1) {
      if (manifest.segments[index].cacheKey === chunk.cacheKey) {
        cursor = index + 1;
        return manifest.segments[index];
      }
    }
    return null;
  });
}
