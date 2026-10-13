import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { getFfmpegPath } from "@/lib/audio/ffmpeg";
import { buildPublishPackage } from "@/lib/export/publish-package";

function ffmpegWithFlite(): boolean {
  const result = spawnSync(getFfmpegPath(), ["-hide_banner", "-filters"], { windowsHide: true, encoding: "utf8" });
  return result.status === 0 && /\bflite\b/.test(result.stdout) && /\balimiter\b/.test(result.stdout);
}

/** Speech-like TTS stand-in: 24 kHz / 48 kbps mono MP3 with leading and trailing silence. */
function makeSpeech(workDir: string, name: string, text: string, gainDb: number) {
  const result = spawnSync(
    getFfmpegPath(),
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `flite=text='${text}':voice=slt`,
      "-af",
      `volume=${gainDb}dB,adelay=300:all=1,apad=pad_dur=0.8,aresample=24000`,
      "-c:a",
      "libmp3lame",
      "-b:a",
      "48k",
      name,
    ],
    { cwd: workDir, windowsHide: true },
  );
  expect(result.status).toBe(0);
}

describe.skipIf(!ffmpegWithFlite())("publish package ffmpeg mastering", () => {
  it("masters loud and quiet chapters so every file passes QC", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "audiobooker-publish-"));
    try {
      makeSpeech(workDir, "chapter-01.mp3", "It was a bright cold day in April, and the clocks were striking thirteen.", 0);
      makeSpeech(workDir, "chapter-02.mp3", "Winston Smith slipped quickly through the glass doors of Victory Mansions.", -12);
      const outputPath = join(workDir, "publish.zip");

      const report = await buildPublishPackage({
        workDir,
        outputPath,
        project: { id: "p1", userId: null, title: "Demo", author: "Jane", narrator: null, language: "en" },
        chapters: [
          { filename: "chapter-01.mp3", title: "One" },
          { filename: "chapter-02.mp3", title: "Two" },
        ],
        creditsVoice: { voiceId: null, speed: 1 },
        metadataText: "Title: Demo",
      });

      expect(report.files).toHaveLength(2);
      for (const file of report.files) {
        expect(file.checks).toEqual({
          rms: true,
          peak: true,
          noiseFloor: true,
          head: true,
          tail: true,
          format: true,
          length: true,
        });
      }
      expect(report.openingCredits.included).toBe(false);
      expect(report.verdict).toBe("fail");

      const zip = await JSZip.loadAsync(await readFile(outputPath));
      expect(Object.keys(zip.files).sort()).toEqual(["01 - One.mp3", "02 - Two.mp3", "METADATA.txt", "QC-REPORT.csv"]);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }, 120_000);
});
