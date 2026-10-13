import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getFfmpegPath, probeDurationSeconds, runFfprobe } from "@/lib/audio/ffmpeg";
import { buildM4b, prepareCover } from "@/lib/export/m4b";

function ffmpegAvailable(): boolean {
  const result = spawnSync(getFfmpegPath(), ["-version"], { windowsHide: true });
  return result.status === 0;
}

function ffmpeg(workDir: string, args: string[]) {
  const result = spawnSync(getFfmpegPath(), ["-y", ...args], { cwd: workDir, windowsHide: true });
  expect(result.status).toBe(0);
}

function makeChapter(workDir: string, name: string, seconds: string) {
  ffmpeg(workDir, [
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=24000",
    "-t",
    seconds,
    "-ac",
    "1",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "48k",
    name,
  ]);
}

function makeImage(workDir: string, name: string, width: number, height: number) {
  ffmpeg(workDir, ["-f", "lavfi", "-i", `testsrc=size=${width}x${height}`, "-frames:v", "1", name]);
}

async function streams(filePath: string) {
  const probe = await runFfprobe(
    ["-v", "error", "-show_streams", "-show_chapters", "-of", "json", filePath],
    { timeoutMs: 30_000 },
  );
  return JSON.parse(probe.stdout) as {
    streams: {
      codec_type: string;
      codec_name: string;
      bit_rate?: string;
      sample_rate?: string;
      channels?: number;
      width?: number;
      height?: number;
      disposition?: { attached_pic?: number };
    }[];
    chapters?: { tags?: { title?: string } }[];
  };
}

const metadata = {
  title: "Demo Book",
  author: "Jane Doe",
  narrator: "Alex",
  language: "en",
  description: "A test",
  publisher: null,
  copyright: "2026",
  aiDisclosure: "Narrated by a synthetic voice.",
};

describe.skipIf(!ffmpegAvailable())("m4b ffmpeg export", () => {
  it("concatenates chapters at the source bitrate with markers and a square cover", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "audiobooker-m4b-"));
    try {
      makeChapter(workDir, "chapter-01.mp3", "3");
      makeChapter(workDir, "chapter-02.mp3", "3");
      makeImage(workDir, "cover.png", 900, 1400);
      const outputPath = join(workDir, "audiobook.m4b");

      const result = await buildM4b({
        workDir,
        chapters: [
          { filename: "chapter-01.mp3", title: "Intro" },
          { filename: "chapter-02.mp3", title: "Chapter One" },
        ],
        metadata,
        coverPath: join(workDir, "cover.png"),
        outputPath,
      });

      expect(result.aac).toEqual({ bitrateKbps: 48, sampleRate: 24000, channels: 1 });
      expect(result.durationSeconds).toBeGreaterThan(5.5);
      expect(await probeDurationSeconds(outputPath)).toBeGreaterThan(5.5);

      const parsed = await streams(outputPath);
      const audio = parsed.streams.find((stream) => stream.codec_type === "audio");
      const art = parsed.streams.find((stream) => stream.codec_type === "video");
      expect(audio).toMatchObject({ codec_name: "aac", sample_rate: "24000", channels: 1 });
      expect(Number(audio?.bit_rate)).toBeLessThanOrEqual(56_000);
      expect(art).toMatchObject({ codec_name: "mjpeg", width: 1400, height: 1400 });
      expect(art?.disposition?.attached_pic).toBe(1);
      expect(parsed.chapters?.map((chapter) => chapter.tags?.title)).toEqual(["Intro", "Chapter One"]);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }, 60_000);

  it("shrinks large covers to 1400px squares and never upscales small ones", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "audiobooker-cover-"));
    try {
      makeImage(workDir, "large.png", 2000, 3000);
      makeImage(workDir, "small.png", 600, 800);

      const large = await prepareCover({ workDir, sourcePath: join(workDir, "large.png") });
      expect((await streams(large ?? ""))).toMatchObject({ streams: [{ width: 1400, height: 1400 }] });

      const small = await prepareCover({ workDir, sourcePath: join(workDir, "small.png") });
      expect((await streams(small ?? ""))).toMatchObject({ streams: [{ width: 800, height: 800 }] });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }, 60_000);
});
