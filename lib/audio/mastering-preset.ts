export const PUBLISH_MASTERING_PRESET = {
  id: "publish-v1",
  silenceThresholdDb: -60,
  targetRmsDb: -20,
  /** Below the -3 dB peak limit to leave room for MP3 encoding overshoot. */
  limiterCeilingDb: -4,
  headSilenceSeconds: 0.75,
  tailSilenceSeconds: 2,
  sampleRateHz: 44_100,
  bitrateKbps: 192,
  limits: {
    rmsDb: [-23, -18] as const,
    maxPeakDb: -3,
    maxNoiseFloorDb: -60,
    headSilenceSeconds: [0.5, 1] as const,
    tailSilenceSeconds: [1, 5] as const,
    maxFileMinutes: 120,
  },
} as const;

export type MasteringPreset = typeof PUBLISH_MASTERING_PRESET;
export type MasteringPresetId = MasteringPreset["id"];

export function isMasteringPresetId(value: string | null | undefined): value is MasteringPresetId {
  return value === PUBLISH_MASTERING_PRESET.id;
}

/** Levels are null when the signal is digital silence (`-inf`). */
export type AudioMeasurement = {
  durationSeconds: number;
  rmsDb: number | null;
  peakDb: number | null;
  noiseFloorDb: number | null;
  headSilenceSeconds: number;
  tailSilenceSeconds: number;
  bitrateKbps: number | null;
  sampleRateHz: number | null;
};
