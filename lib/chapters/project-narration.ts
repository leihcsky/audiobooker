import { normalizeSpeechSpeed } from "@/lib/tts/speed";

/** Chapter fields needed to decide project-level generate vs rematch. */
export type ProjectNarrationChapter = {
  id: string;
  included: boolean;
  status: string;
  characterCount: number;
  hasAudio: boolean;
  audioOutdated: boolean;
  selectedVoiceId: string | null;
  selectedSpeed: number;
};

export type ProjectNarrationPlan = {
  /** Included chapters to send to project generate, in chapter order. */
  targets: ProjectNarrationChapter[];
  /** Ready chapters that will be overwritten because voice/speed differs. */
  rematchCount: number;
  /** True when any target already has current (non-outdated) audio. */
  overwritesAudio: boolean;
};

export function chapterNeedsNarration(chapter: ProjectNarrationChapter): boolean {
  return (
    chapter.included &&
    chapter.status !== "GENERATING" &&
    chapter.characterCount > 0 &&
    (!chapter.hasAudio || chapter.audioOutdated)
  );
}

/** Ready audio whose last voice/speed no longer matches the project controls. */
export function chapterNeedsRematch(
  chapter: ProjectNarrationChapter,
  voiceId: string,
  speed: number,
): boolean {
  if (
    !chapter.included ||
    chapter.status === "GENERATING" ||
    chapter.characterCount <= 0 ||
    !chapter.hasAudio ||
    chapter.audioOutdated
  ) {
    return false;
  }
  const wantedSpeed = normalizeSpeechSpeed(speed);
  const currentSpeed = normalizeSpeechSpeed(chapter.selectedSpeed);
  return chapter.selectedVoiceId !== voiceId || currentSpeed !== wantedSpeed;
}

/**
 * Chapters the project Generate button should cover for the current voice/speed:
 * missing/outdated audio, plus ready chapters that no longer match the selection.
 */
export function planProjectNarration(
  chapters: ProjectNarrationChapter[],
  voiceId: string,
  speed: number,
): ProjectNarrationPlan {
  const targets = chapters.filter(
    (chapter) => chapterNeedsNarration(chapter) || chapterNeedsRematch(chapter, voiceId, speed),
  );
  const rematchCount = targets.filter((chapter) => chapterNeedsRematch(chapter, voiceId, speed)).length;
  return {
    targets,
    rematchCount,
    overwritesAudio: rematchCount > 0,
  };
}
