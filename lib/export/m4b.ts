import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { probeAudioFile, runFfmpeg, type AudioProbe } from "@/lib/audio/ffmpeg";
import { buildConcatList, buildFfmetadata, type AudiobookMetadata } from "@/lib/export/ffmetadata";

export type M4bChapterInput = {
  filename: string;
  title: string;
  durationSeconds?: number | null;
};

export type AacSettings = {
  bitrateKbps: number;
  sampleRate: number;
  channels: 1 | 2;
};

/** Apple Books asks for square art at least 1400px on the short side; smaller art must not be upscaled. */
export const COVER_SIZE = 1400;

const DEFAULT_AAC: AacSettings = { bitrateKbps: 48, sampleRate: 24_000, channels: 1 };
const MIN_AAC_KBPS = 32;
const MAX_AAC_KBPS = 128;

/**
 * Re-encoding narration above its source bitrate only grows the file, so the
 * AAC target follows the richest chapter (Edge TTS sources are 48 kbps mono).
 */
export function aacSettingsFor(probes: AudioProbe[]): AacSettings {
  const bitRates = probes.map((probe) => probe.bitRate).filter((value): value is number => value !== null);
  const sampleRates = probes.map((probe) => probe.sampleRate).filter((value): value is number => value !== null);
  const channels = probes.map((probe) => probe.channels).filter((value): value is number => value !== null);
  const kbps = bitRates.length > 0 ? Math.round(Math.max(...bitRates) / 1000) : DEFAULT_AAC.bitrateKbps;
  return {
    bitrateKbps: Math.min(MAX_AAC_KBPS, Math.max(MIN_AAC_KBPS, kbps)),
    sampleRate: sampleRates.length > 0 ? Math.max(...sampleRates) : DEFAULT_AAC.sampleRate,
    channels: channels.some((value) => value >= 2) ? 2 : 1,
  };
}

/**
 * Fits the whole cover (no cropping of title or author) inside a square no
 * larger than COVER_SIZE, filling the sides with a blurred copy of itself.
 */
export function coverFilter(size = COVER_SIZE): string {
  return [
    `[0:v]scale='min(${size},iw)':'min(${size},ih)':force_original_aspect_ratio=decrease,setsar=1,split=2[fg][bg]`,
    "[bg]scale='max(iw,ih)':'max(iw,ih)':force_original_aspect_ratio=increase,crop='min(iw,ih)':'min(iw,ih)',boxblur=20:2,eq=brightness=-0.08[blur]",
    "[blur][fg]overlay=(W-w)/2:(H-h)/2,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuvj420p[cover]",
  ].join(";");
}

export async function prepareCover(input: { workDir: string; sourcePath: string }): Promise<string | undefined> {
  const outputPath = join(input.workDir, "cover.jpg");
  try {
    await runFfmpeg(
      [
        "-y",
        "-i",
        input.sourcePath,
        "-filter_complex",
        coverFilter(),
        "-map",
        "[cover]",
        "-frames:v",
        "1",
        "-q:v",
        "3",
        outputPath,
      ],
      { cwd: input.workDir, timeoutMs: 60_000 },
    );
    return outputPath;
  } catch (error) {
    console.warn("m4b_cover_skipped", { reason: error instanceof Error ? error.message : "unknown" });
    return undefined;
  }
}

export async function buildM4b(input: {
  workDir: string;
  chapters: M4bChapterInput[];
  metadata: AudiobookMetadata;
  coverPath?: string;
  outputPath: string;
}): Promise<{ durationSeconds: number; aac: AacSettings }> {
  const markers: { title: string; startMs: number; endMs: number }[] = [];
  const probes: AudioProbe[] = [];
  let cursorMs = 0;

  for (const chapter of input.chapters) {
    const probe = await probeAudioFile(join(input.workDir, chapter.filename));
    probes.push(probe);
    const durationSeconds = probe.durationSeconds ?? chapter.durationSeconds ?? 0;
    const durationMs = Math.max(1, Math.round(durationSeconds * 1000));
    markers.push({
      title: chapter.title,
      startMs: cursorMs,
      endMs: cursorMs + durationMs,
    });
    cursorMs += durationMs;
  }

  const concatPath = join(input.workDir, "concat.txt");
  const metadataPath = join(input.workDir, "ffmetadata.txt");
  await writeFile(concatPath, buildConcatList(input.chapters.map((chapter) => chapter.filename)), "utf8");
  await writeFile(
    metadataPath,
    buildFfmetadata({
      metadata: input.metadata,
      chapters: markers,
    }),
    "utf8",
  );

  const aac = aacSettingsFor(probes);
  const audioArgs = [
    "-c:a",
    "aac",
    "-b:a",
    `${aac.bitrateKbps}k`,
    "-ar",
    String(aac.sampleRate),
    "-ac",
    String(aac.channels),
  ];
  const cover = input.coverPath
    ? await prepareCover({ workDir: input.workDir, sourcePath: input.coverPath })
    : undefined;

  const args = ["-y", "-f", "concat", "-safe", "0", "-i", concatPath];
  if (cover) {
    args.push(
      "-i",
      cover,
      "-i",
      metadataPath,
      "-map",
      "0:a",
      "-map",
      "1:v",
      "-map_metadata",
      "2",
      ...audioArgs,
      "-c:v",
      "copy",
      "-disposition:v:0",
      "attached_pic",
    );
  } else {
    args.push("-i", metadataPath, "-map_metadata", "1", ...audioArgs, "-vn");
  }

  args.push("-movflags", "+faststart", input.outputPath);
  await runFfmpeg(args, { cwd: input.workDir });

  return { durationSeconds: cursorMs / 1000, aac };
}
