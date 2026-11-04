export const MIN_SPEECH_SPEED = 0.5;
export const MAX_SPEECH_SPEED = 2;
export const DEFAULT_SPEECH_SPEED = 1;

export function normalizeSpeechSpeed(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_SPEECH_SPEED;
  }
  const clamped = Math.min(MAX_SPEECH_SPEED, Math.max(MIN_SPEECH_SPEED, value));
  return Math.round(clamped * 100) / 100;
}

/** Clamp speed, or force 1.0× when the voice/provider cannot vary rate. */
export function effectiveSpeechSpeed(
  value: number | undefined,
  supportsSpeed: boolean | undefined = true,
): number {
  if (supportsSpeed === false) {
    return DEFAULT_SPEECH_SPEED;
  }
  return normalizeSpeechSpeed(value);
}

export function voiceSupportsSpeed(supportsSpeed: boolean | undefined): boolean {
  return supportsSpeed !== false;
}
