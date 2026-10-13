import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { masterAudioFile } from "@/lib/audio/mastering";
import { PUBLISH_MASTERING_PRESET } from "@/lib/audio/mastering-preset";
import { chapterZipEntryName } from "@/lib/export/filenames";
import { buildOpeningCreditsText, synthesizeOpeningCredits } from "@/lib/export/opening-credits";
import { buildQcCsv, buildQcReport, qcFileResult, type QcFileResult, type QcReport } from "@/lib/export/qc-report";
import { writeZipFile } from "@/lib/export/zip";

export const OPENING_CREDITS_FILENAME = "00 - Opening Credits.mp3";

export type PublishPackageInput = {
  workDir: string;
  outputPath: string;
  project: {
    id: string;
    userId: string | null;
    title: string;
    author: string | null;
    narrator: string | null;
    language: string;
  };
  /** Raw chapter files already written to `workDir`, in book order. */
  chapters: { filename: string; title: string }[];
  creditsVoice: { voiceId: string | null; speed: number };
  metadataText: string;
};

async function masterOpeningCredits(
  input: PublishPackageInput,
  masteredDir: string,
  trackTotal: number,
): Promise<{ file: QcFileResult; path: string } | null> {
  const { project, creditsVoice } = input;
  if (!project.userId || !creditsVoice.voiceId) {
    return null;
  }
  try {
    const text = buildOpeningCreditsText(project);
    const audio = await synthesizeOpeningCredits({
      userId: project.userId,
      text,
      voiceId: creditsVoice.voiceId,
      speed: creditsVoice.speed,
    });
    const rawPath = join(input.workDir, "opening-credits-raw.mp3");
    await writeFile(rawPath, audio);
    const path = join(masteredDir, OPENING_CREDITS_FILENAME);
    const measurement = await masterAudioFile({
      inputPath: rawPath,
      outputPath: path,
      cwd: input.workDir,
      tags: { title: "Opening Credits", artist: project.author, album: project.title, track: `1/${trackTotal}` },
    });
    return { file: qcFileResult({ name: OPENING_CREDITS_FILENAME, title: "Opening Credits", measurement }), path };
  } catch (error) {
    console.warn("opening_credits_failed", {
      projectId: project.id,
      voiceId: creditsVoice.voiceId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

/** Masters every chapter, adds opening credits, and writes the ZIP. Returns the QC report. */
export async function buildPublishPackage(input: PublishPackageInput): Promise<QcReport> {
  const masteredDir = join(input.workDir, "mastered");
  await mkdir(masteredDir, { recursive: true });
  const trackTotal = input.chapters.length + 1;

  const credits = await masterOpeningCredits(input, masteredDir, trackTotal);
  const files: QcFileResult[] = credits ? [credits.file] : [];
  const zipFiles: { filename: string; path: string }[] = credits
    ? [{ filename: OPENING_CREDITS_FILENAME, path: credits.path }]
    : [];

  for (const [index, chapter] of input.chapters.entries()) {
    const name = chapterZipEntryName(index + 1, chapter.title);
    const path = join(masteredDir, `chapter-${index + 1}.mp3`);
    const measurement = await masterAudioFile({
      inputPath: join(input.workDir, chapter.filename),
      outputPath: path,
      cwd: input.workDir,
      tags: {
        title: chapter.title,
        artist: input.project.author,
        album: input.project.title,
        track: `${index + 2}/${trackTotal}`,
      },
    });
    files.push(qcFileResult({ name, title: chapter.title, measurement }));
    zipFiles.push({ filename: name, path });
  }

  const report = buildQcReport({
    files,
    openingCredits: { included: credits !== null, voiceId: credits ? input.creditsVoice.voiceId : null },
    preset: PUBLISH_MASTERING_PRESET,
  });
  await writeZipFile({
    files: zipFiles,
    texts: [
      { filename: "METADATA.txt", content: input.metadataText },
      { filename: "QC-REPORT.csv", content: buildQcCsv(report) },
    ],
    outputPath: input.outputPath,
  });
  return report;
}
