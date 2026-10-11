import { ttsAudioInvalid, ttsAudioTruncated } from "@/lib/api/errors";
import { TTS_SETTINGS } from "@/lib/config/limits";
import { estimateMp3DurationSeconds } from "@/lib/tts/mp3";

const TRUNCATION_CHECK_MIN_CHARACTERS = 200;

export type AudioValidationInput = {
  characters: number;
  speed: number;
  maxCharsPerSecond?: number;
};

/**
 * Rejects empty or unreadable MP3 output and output that is far too short for
 * the text. The ratio is deliberately loose because speaking rate varies a lot
 * by language and voice.
 */
export function validateSynthesizedAudio(
  audio: Buffer,
  input: AudioValidationInput,
): { durationSeconds: number } {
  if (audio.length === 0) {
    throw ttsAudioInvalid();
  }
  const durationSeconds = estimateMp3DurationSeconds(audio);
  if (durationSeconds === null || durationSeconds <= 0) {
    throw ttsAudioInvalid();
  }

  if (input.characters >= TRUNCATION_CHECK_MIN_CHARACTERS) {
    const maxCharsPerSecond = input.maxCharsPerSecond ?? TTS_SETTINGS.MAX_CHARS_PER_AUDIO_SECOND;
    const speed = input.speed > 0 ? input.speed : 1;
    const minimumSeconds = input.characters / (maxCharsPerSecond * speed);
    if (durationSeconds < minimumSeconds) {
      throw ttsAudioTruncated();
    }
  }

  return { durationSeconds };
}
