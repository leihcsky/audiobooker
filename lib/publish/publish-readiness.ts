import { parseQcReport } from "@/lib/export/qc-report";
import { DEFAULT_NARRATOR_CREDIT } from "@/lib/publish/disclosure";
import type { PublishPlatform } from "@/lib/publish/platforms";

export type PublishCheckStatus = "pass" | "warn" | "fail" | "todo";

export type PublishCheck = {
  id: string;
  label: string;
  status: PublishCheckStatus;
  detail: string;
  fix?: { label: string; href: string };
};

export type PublishChapterInput = {
  title: string;
  included: boolean;
  hasAudio: boolean;
  audioOutdated: boolean;
  durationSeconds: number | null;
};

export type PublishReadinessInput = {
  projectId: string;
  author: string | null;
  narrator: string | null;
  description: string | null;
  cover: { present: boolean; width: number | null; height: number | null };
  chapters: PublishChapterInput[];
  publishAudio: PublishAudioState;
  /** Whether the user's plan includes publish-ready (mastered) exports. */
  canMaster: boolean;
};

/**
 * State of the newest completed publish-ready export: none, older than the
 * current chapter audio, failed QC, or ready.
 */
export type PublishAudioState = {
  status: "none" | "stale" | "failed" | "ready";
  failingFiles: number;
  creditsIncluded: boolean;
};

export type PublishReadiness = {
  platformId: PublishPlatform["id"];
  checks: PublishCheck[];
  blockingCount: number;
};

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}

function coverCheck(input: PublishReadinessInput, platform: PublishPlatform, coverHref: string): PublishCheck {
  const label = "Cover art";
  const fix = { label: "Upload cover", href: coverHref };
  const { present, width, height } = input.cover;
  const { minPixels, recommendedPixels, squareRequired } = platform.cover;
  if (!present) {
    return { id: "cover", label, status: "fail", detail: "Add a square cover with the title and author on it.", fix };
  }
  if (width === null || height === null) {
    return { id: "cover", label, status: "warn", detail: "Re-upload the cover so its size can be checked.", fix };
  }
  const square = width === height;
  const shortSide = Math.min(width, height);
  if (!square && squareRequired) {
    return { id: "cover", label, status: "fail", detail: `The cover is ${width}×${height}; ${platform.name} needs a square (1:1) image.`, fix };
  }
  if (minPixels !== null && shortSide < minPixels) {
    return { id: "cover", label, status: "fail", detail: `The cover is ${width}×${height}; ${platform.name} needs at least ${minPixels}×${minPixels}.`, fix };
  }
  if (!square) {
    return { id: "cover", label, status: "warn", detail: `The cover is ${width}×${height}. ${platform.name} recommends a square image and will letterbox others.`, fix };
  }
  if (shortSide < recommendedPixels) {
    return { id: "cover", label, status: "warn", detail: `The cover is ${width}×${height}; ${platform.name} recommends ${recommendedPixels}×${recommendedPixels}.`, fix };
  }
  return { id: "cover", label, status: "pass", detail: `${width}×${height}, square.` };
}

type ChapterAudioStamp = {
  included: boolean;
  audioOutdated: boolean;
  currentAudioFile: { createdAt: Date } | null;
};

export function publishAudioState(
  latest: { createdAt: Date; qcReport: unknown } | null,
  chapters: ChapterAudioStamp[],
): PublishAudioState {
  const none: PublishAudioState = { status: "none", failingFiles: 0, creditsIncluded: false };
  const report = latest ? parseQcReport(latest.qcReport) : null;
  if (!latest || !report) {
    return none;
  }
  const stale = chapters.some(
    (chapter) =>
      chapter.included &&
      (!chapter.currentAudioFile ||
        chapter.audioOutdated ||
        chapter.currentAudioFile.createdAt.getTime() > latest.createdAt.getTime()),
  );
  const creditsIncluded = report.openingCredits.included;
  if (stale) {
    return { status: "stale", failingFiles: 0, creditsIncluded };
  }
  return {
    status: report.verdict === "pass" ? "ready" : "failed",
    failingFiles: report.files.filter((file) => !file.pass).length,
    creditsIncluded,
  };
}

function audioSpecCheck(
  input: PublishReadinessInput,
  audioSpec: string,
  exportFix: { label: string; href: string },
  reportHref: string,
): PublishCheck {
  const base = { id: "audio-spec", label: "Audio format and levels" };
  const { status, failingFiles } = input.publishAudio;
  if (status === "ready") {
    return { ...base, status: "pass", detail: `Publish-ready export passed every check: ${audioSpec}.` };
  }
  if (status === "failed") {
    return {
      ...base,
      status: "fail",
      detail: `The latest publish-ready export has ${failingFiles} ${failingFiles === 1 ? "file" : "files"} that failed a check.`,
      fix: { label: "View report", href: reportHref },
    };
  }
  if (status === "stale") {
    return {
      ...base,
      status: "fail",
      detail: "Chapter audio changed after the last publish-ready export. Export again.",
      fix: exportFix,
    };
  }
  return {
    ...base,
    status: "fail",
    detail: input.canMaster
      ? `Narration files must be ${audioSpec}, with even loudness and silence at the start and end. A publish-ready export does this.`
      : `Narration files must be ${audioSpec}, with even loudness and silence at the start and end. Publish-ready exports are part of the Creator plan.`,
    fix: exportFix,
  };
}

export function evaluatePublishReadiness(
  input: PublishReadinessInput,
  platform: PublishPlatform,
): PublishReadiness {
  const projectHref = `/studio/projects/${input.projectId}`;
  const exportHref = `${projectHref}/export`;
  const metadataHref = `${exportHref}#metadata`;
  const included = input.chapters.filter((chapter) => chapter.included);
  const checks: PublishCheck[] = [];

  checks.push(
    input.author
      ? { id: "author", label: "Author", status: "pass", detail: input.author }
      : { id: "author", label: "Author", status: "fail", detail: "Add the author's name.", fix: { label: "Edit metadata", href: metadataHref } },
  );

  if (input.narrator) {
    checks.push({ id: "narrator", label: "Narrator credit", status: "pass", detail: input.narrator });
  } else {
    checks.push({
      id: "narrator",
      label: "Narrator credit",
      status: platform.narratorRequired ? "fail" : "warn",
      detail: `Add a narrator credit, for example “${DEFAULT_NARRATOR_CREDIT}”.`,
      fix: { label: "Edit metadata", href: metadataHref },
    });
  }

  if (input.description) {
    checks.push({ id: "description", label: "Description", status: "pass", detail: "Added." });
  } else {
    checks.push({
      id: "description",
      label: "Description",
      status: platform.descriptionRequired ? "fail" : "warn",
      detail: "Add a short description of the book for the store listing.",
      fix: { label: "Edit metadata", href: metadataHref },
    });
  }

  checks.push(coverCheck(input, platform, `${exportHref}#cover`));

  const missing = included.filter((chapter) => !chapter.hasAudio);
  const outdated = included.filter((chapter) => chapter.hasAudio && chapter.audioOutdated);
  if (included.length === 0) {
    checks.push({ id: "chapters", label: "Chapter audio", status: "fail", detail: "Select at least one chapter for the audiobook.", fix: { label: "Open project", href: projectHref } });
  } else if (missing.length > 0) {
    checks.push({ id: "chapters", label: "Chapter audio", status: "fail", detail: `${missing.length} of ${included.length} chapters have no audio yet.`, fix: { label: "Generate audio", href: projectHref } });
  } else if (outdated.length > 0) {
    checks.push({ id: "chapters", label: "Chapter audio", status: "warn", detail: `${outdated.length} chapters changed after their audio was made.`, fix: { label: "Regenerate", href: projectHref } });
  } else {
    checks.push({ id: "chapters", label: "Chapter audio", status: "pass", detail: `All ${included.length} chapters have audio.` });
  }

  const maxMinutes = platform.audio.maxFileMinutes;
  if (maxMinutes !== null) {
    const tooLong = included.filter(
      (chapter) => chapter.durationSeconds !== null && chapter.durationSeconds > maxMinutes * 60,
    );
    checks.push(
      tooLong.length > 0
        ? {
            id: "chapter-length",
            label: "Chapter length",
            status: "fail",
            detail: `${platform.name} accepts files up to ${maxMinutes} minutes. Split “${tooLong[0].title}” (${formatMinutes(tooLong[0].durationSeconds ?? 0)}) into shorter chapters.`,
            fix: { label: "Open project", href: projectHref },
          }
        : { id: "chapter-length", label: "Chapter length", status: "pass", detail: `Every chapter is under ${maxMinutes} minutes.` },
    );
  }

  const minTotal = platform.audio.minTotalMinutes;
  if (minTotal !== null) {
    const totalSeconds = included.reduce((sum, chapter) => sum + (chapter.durationSeconds ?? 0), 0);
    checks.push(
      totalSeconds < minTotal * 60
        ? { id: "total-length", label: "Total length", status: "fail", detail: `${platform.name} needs at least ${minTotal} minutes of audio; this book has ${formatMinutes(totalSeconds)}.` }
        : { id: "total-length", label: "Total length", status: "pass", detail: formatMinutes(totalSeconds) },
    );
  }

  const audioSpec = [
    `MP3, ${platform.audio.minBitrateKbps} kbps or higher`,
    platform.audio.constantBitrate ? "constant bitrate" : null,
    platform.audio.sampleRateHz ? `${platform.audio.sampleRateHz / 1000} kHz` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const exportFix = input.canMaster
    ? { label: "Create publish-ready export", href: `${exportHref}#publish-ready` }
    : { label: "See Creator plan", href: "/pricing" };
  checks.push(audioSpecCheck(input, audioSpec, exportFix, `${exportHref}#exports`));

  if (platform.openingCreditsRequired) {
    const { status, creditsIncluded } = input.publishAudio;
    const current = status === "ready" || status === "failed";
    checks.push(
      current && creditsIncluded
        ? { id: "opening-credits", label: "Opening credits", status: "pass", detail: "Included in the publish-ready export." }
        : {
            id: "opening-credits",
            label: "Opening credits",
            status: "fail",
            detail: current
              ? "The opening credits could not be created. Export again; if it keeps failing, try another voice for the first chapter."
              : `${platform.name} needs an opening-credits track with the title, author, and narrator. A publish-ready export adds it.`,
            fix: exportFix,
          },
    );
  }

  checks.push({ id: "disclosure", label: "AI narration disclosure", status: "todo", detail: platform.disclosureStep });

  return {
    platformId: platform.id,
    checks,
    blockingCount: checks.filter((check) => check.status === "fail").length,
  };
}
