import {
  PUBLISH_MASTERING_PRESET,
  type AudioMeasurement,
  type MasteringPreset,
  type MasteringPresetId,
} from "@/lib/audio/mastering-preset";

export type QcCheckId = "rms" | "peak" | "noiseFloor" | "head" | "tail" | "format" | "length";

export const QC_CHECK_LABELS: Record<QcCheckId, string> = {
  rms: "Loudness (RMS)",
  peak: "Peak level",
  noiseFloor: "Noise floor",
  head: "Silence at start",
  tail: "Silence at end",
  format: "MP3 format",
  length: "File length",
};

export type QcFileResult = AudioMeasurement & {
  name: string;
  title: string;
  checks: Record<QcCheckId, boolean>;
  pass: boolean;
};

export type QcReport = {
  preset: MasteringPresetId;
  verdict: "pass" | "fail";
  totalDurationSeconds: number;
  openingCredits: { included: boolean; voiceId: string | null };
  files: QcFileResult[];
};

function within(value: number, [min, max]: readonly [number, number]): boolean {
  return value >= min && value <= max;
}

export function evaluateQcChecks(
  measurement: AudioMeasurement,
  preset: MasteringPreset = PUBLISH_MASTERING_PRESET,
): Record<QcCheckId, boolean> {
  const { limits } = preset;
  return {
    rms: measurement.rmsDb !== null && within(measurement.rmsDb, limits.rmsDb),
    peak: measurement.peakDb === null || measurement.peakDb <= limits.maxPeakDb,
    noiseFloor: measurement.noiseFloorDb === null || measurement.noiseFloorDb <= limits.maxNoiseFloorDb,
    head: within(measurement.headSilenceSeconds, limits.headSilenceSeconds),
    tail: within(measurement.tailSilenceSeconds, limits.tailSilenceSeconds),
    format:
      measurement.bitrateKbps !== null &&
      measurement.bitrateKbps >= preset.bitrateKbps &&
      measurement.sampleRateHz === preset.sampleRateHz,
    length: measurement.durationSeconds <= limits.maxFileMinutes * 60,
  };
}

export function qcFileResult(input: {
  name: string;
  title: string;
  measurement: AudioMeasurement;
  preset?: MasteringPreset;
}): QcFileResult {
  const checks = evaluateQcChecks(input.measurement, input.preset);
  return {
    name: input.name,
    title: input.title,
    ...input.measurement,
    checks,
    pass: Object.values(checks).every(Boolean),
  };
}

export function buildQcReport(input: {
  files: QcFileResult[];
  openingCredits: { included: boolean; voiceId: string | null };
  preset?: MasteringPreset;
}): QcReport {
  const preset = input.preset ?? PUBLISH_MASTERING_PRESET;
  const totalDurationSeconds = input.files.reduce((sum, file) => sum + file.durationSeconds, 0);
  const pass = input.files.length > 0 && input.files.every((file) => file.pass) && input.openingCredits.included;
  return {
    preset: preset.id,
    verdict: pass ? "pass" : "fail",
    totalDurationSeconds: Math.round(totalDurationSeconds * 1000) / 1000,
    openingCredits: input.openingCredits,
    files: input.files,
  };
}

function csvCell(value: string | number | boolean | null): string {
  if (value === null) {
    return "";
  }
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function levelCell(value: number | null): string {
  return value === null ? "-inf" : value.toFixed(1);
}

export function buildQcCsv(report: QcReport): string {
  const checkIds = Object.keys(QC_CHECK_LABELS) as QcCheckId[];
  const header = [
    "File",
    "Duration (s)",
    "RMS (dB)",
    "Peak (dB)",
    "Noise floor (dB)",
    "Start silence (s)",
    "End silence (s)",
    "Bitrate (kbps)",
    "Sample rate (Hz)",
    ...checkIds.map((id) => QC_CHECK_LABELS[id]),
    "Result",
  ];
  const rows = report.files.map((file) => [
    csvCell(file.name),
    file.durationSeconds.toFixed(1),
    levelCell(file.rmsDb),
    levelCell(file.peakDb),
    levelCell(file.noiseFloorDb),
    file.headSilenceSeconds.toFixed(2),
    file.tailSilenceSeconds.toFixed(2),
    csvCell(file.bitrateKbps),
    csvCell(file.sampleRateHz),
    ...checkIds.map((id) => (file.checks[id] ? "pass" : "fail")),
    file.pass ? "pass" : "fail",
  ]);
  const summary = [
    `# Preset: ${report.preset}`,
    `# Verdict: ${report.verdict}`,
    `# Opening credits: ${report.openingCredits.included ? "included" : "missing"}`,
  ];
  return [...summary, header.map(csvCell).join(","), ...rows.map((row) => row.join(","))].join("\r\n") + "\r\n";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads a stored report; returns null for anything that is not a report this code wrote. */
export function parseQcReport(value: unknown): QcReport | null {
  if (!isRecord(value) || value.preset !== PUBLISH_MASTERING_PRESET.id) {
    return null;
  }
  if ((value.verdict !== "pass" && value.verdict !== "fail") || !Array.isArray(value.files)) {
    return null;
  }
  if (!isRecord(value.openingCredits) || typeof value.totalDurationSeconds !== "number") {
    return null;
  }
  return value as QcReport;
}
