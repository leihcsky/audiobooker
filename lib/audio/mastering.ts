import { AppError } from "@/lib/api/errors";
import { probeAudioFile, runFfmpeg } from "@/lib/audio/ffmpeg";
import {
  PUBLISH_MASTERING_PRESET,
  type AudioMeasurement,
  type MasteringPreset,
} from "@/lib/audio/mastering-preset";

export type ID3Tags = {
  title: string;
  artist: string | null;
  album: string;
  track: string;
};

const EDGE_TOLERANCE_SECONDS = 0.1;
/** Kept before the first sound when trimming, so soft onsets are not clipped. */
const TRIM_CUSHION_SECONDS = 0.05;
const MAX_GAIN_DB = 30;

function lastLevel(stderr: string, label: string): number | null {
  const pattern = new RegExp(`${label} dB:\\s*(-?inf|-?\\d+(?:\\.\\d+)?)`, "g");
  let value: string | null = null;
  for (const match of stderr.matchAll(pattern)) {
    value = match[1];
  }
  if (value === null || value.endsWith("inf")) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type SilenceInterval = { start: number; end: number | null };

function silenceIntervals(stderr: string): SilenceInterval[] {
  const intervals: SilenceInterval[] = [];
  for (const match of stderr.matchAll(/silence_(start|end):\s*(-?\d+(?:\.\d+)?)/g)) {
    const value = Number.parseFloat(match[2]);
    if (match[1] === "start") {
      intervals.push({ start: value, end: null });
    } else if (intervals.length > 0 && intervals[intervals.length - 1].end === null) {
      intervals[intervals.length - 1].end = value;
    }
  }
  return intervals;
}

/** Parses `silencedetect` + `astats` output for a file of known duration. */
export function parseAnalysis(
  stderr: string,
  durationSeconds: number,
): Pick<AudioMeasurement, "rmsDb" | "peakDb" | "noiseFloorDb" | "headSilenceSeconds" | "tailSilenceSeconds"> {
  const intervals = silenceIntervals(stderr);
  const first = intervals[0];
  const last = intervals[intervals.length - 1];
  const headSilenceSeconds =
    first && first.start <= EDGE_TOLERANCE_SECONDS ? (first.end ?? durationSeconds) - first.start : 0;
  let tailSilenceSeconds = 0;
  if (last) {
    const end = last.end ?? durationSeconds;
    if (end >= durationSeconds - EDGE_TOLERANCE_SECONDS) {
      tailSilenceSeconds = end - last.start;
    }
  }
  return {
    rmsDb: lastLevel(stderr, "RMS level"),
    peakDb: lastLevel(stderr, "Peak level"),
    noiseFloorDb: lastLevel(stderr, "Noise floor"),
    headSilenceSeconds: round(headSilenceSeconds, 3),
    tailSilenceSeconds: round(tailSilenceSeconds, 3),
  };
}

export async function measureAudio(
  filePath: string,
  preset: MasteringPreset = PUBLISH_MASTERING_PRESET,
): Promise<AudioMeasurement> {
  const probe = await probeAudioFile(filePath);
  if (!probe.durationSeconds) {
    throw new AppError("EXPORT_AUDIO_INVALID", "Audio file has no duration.", 422);
  }
  const { stderr } = await runFfmpeg([
    "-hide_banner",
    "-nostats",
    "-i",
    filePath,
    "-af",
    `silencedetect=noise=${preset.silenceThresholdDb}dB:d=0.1,astats=measure_perchannel=none`,
    "-f",
    "null",
    "-",
  ]);
  return {
    durationSeconds: round(probe.durationSeconds, 3),
    ...parseAnalysis(stderr, probe.durationSeconds),
    bitrateKbps: probe.bitRate === null ? null : Math.round(probe.bitRate / 1000),
    sampleRateHz: probe.sampleRate,
  };
}

export function masteringFilter(input: {
  trimStartSeconds: number;
  trimEndSeconds: number;
  gainDb: number;
  preset?: MasteringPreset;
}): string {
  const preset = input.preset ?? PUBLISH_MASTERING_PRESET;
  const ceiling = Math.pow(10, preset.limiterCeilingDb / 20);
  return [
    `atrim=start=${input.trimStartSeconds.toFixed(3)}:end=${input.trimEndSeconds.toFixed(3)}`,
    "asetpts=PTS-STARTPTS",
    `aresample=${preset.sampleRateHz}`,
    `volume=${input.gainDb.toFixed(2)}dB`,
    `alimiter=limit=${ceiling.toFixed(4)}:level=0:attack=5:release=50`,
    `adelay=${Math.round(preset.headSilenceSeconds * 1000)}:all=1`,
    `apad=pad_dur=${preset.tailSilenceSeconds}`,
    "asetpts=N/SR/TB",
  ].join(",");
}

/** Trim range and gain that bring a measured file to the preset. */
export function masteringPlan(
  measurement: AudioMeasurement,
  preset: MasteringPreset = PUBLISH_MASTERING_PRESET,
): { trimStartSeconds: number; trimEndSeconds: number; gainDb: number } {
  if (measurement.rmsDb === null) {
    throw new AppError("EXPORT_AUDIO_INVALID", "Audio file is silent.", 422);
  }
  const trimStartSeconds = Math.max(0, measurement.headSilenceSeconds - TRIM_CUSHION_SECONDS);
  const trimEndSeconds =
    measurement.durationSeconds - Math.max(0, measurement.tailSilenceSeconds - TRIM_CUSHION_SECONDS);
  if (trimEndSeconds - trimStartSeconds <= 0) {
    throw new AppError("EXPORT_AUDIO_INVALID", "Audio file is silent.", 422);
  }
  const gainDb = Math.max(-MAX_GAIN_DB, Math.min(MAX_GAIN_DB, preset.targetRmsDb - measurement.rmsDb));
  return { trimStartSeconds, trimEndSeconds, gainDb };
}

export async function masterAudioFile(input: {
  inputPath: string;
  outputPath: string;
  tags: ID3Tags;
  cwd: string;
  preset?: MasteringPreset;
}): Promise<AudioMeasurement> {
  const preset = input.preset ?? PUBLISH_MASTERING_PRESET;
  const plan = masteringPlan(await measureAudio(input.inputPath, preset), preset);
  const tagArgs = [
    "-metadata",
    `title=${input.tags.title}`,
    "-metadata",
    `album=${input.tags.album}`,
    "-metadata",
    `track=${input.tags.track}`,
    "-metadata",
    "genre=Audiobook",
  ];
  if (input.tags.artist) {
    tagArgs.push("-metadata", `artist=${input.tags.artist}`, "-metadata", `album_artist=${input.tags.artist}`);
  }
  await runFfmpeg(
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      input.inputPath,
      "-map_metadata",
      "-1",
      "-af",
      masteringFilter({ ...plan, preset }),
      "-ac",
      "1",
      "-ar",
      String(preset.sampleRateHz),
      "-c:a",
      "libmp3lame",
      "-b:a",
      `${preset.bitrateKbps}k`,
      "-id3v2_version",
      "3",
      ...tagArgs,
      input.outputPath,
    ],
    { cwd: input.cwd },
  );
  return measureAudio(input.outputPath, preset);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
