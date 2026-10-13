import { describe, expect, it } from "vitest";
import { masteringFilter, masteringPlan, parseAnalysis } from "@/lib/audio/mastering";
import type { AudioMeasurement } from "@/lib/audio/mastering-preset";

const STDERR = `
[silencedetect @ 0x1] silence_start: 0
[silencedetect @ 0x1] silence_end: 0.317333 | silence_duration: 0.317333
[silencedetect @ 0x1] silence_start: 5.2
[silencedetect @ 0x1] silence_end: 5.5 | silence_duration: 0.3
[silencedetect @ 0x1] silence_start: 12.359542
[silencedetect @ 0x1] silence_end: 13.16 | silence_duration: 0.800458
[Parsed_astats_1 @ 0x2] Peak level dB: -4.466836
[Parsed_astats_1 @ 0x2] RMS level dB: -17.294156
[Parsed_astats_1 @ 0x2] Noise floor dB: -inf
`;

function measurement(overrides: Partial<AudioMeasurement> = {}): AudioMeasurement {
  return {
    durationSeconds: 13.16,
    rmsDb: -17.3,
    peakDb: -4.5,
    noiseFloorDb: null,
    headSilenceSeconds: 0.317,
    tailSilenceSeconds: 0.8,
    bitrateKbps: 48,
    sampleRateHz: 24_000,
    ...overrides,
  };
}

describe("parseAnalysis", () => {
  it("reads levels and head/tail silence, ignoring pauses in the middle", () => {
    expect(parseAnalysis(STDERR, 13.16)).toEqual({
      rmsDb: -17.294156,
      peakDb: -4.466836,
      noiseFloorDb: null,
      headSilenceSeconds: 0.317,
      tailSilenceSeconds: 0.8,
    });
  });

  it("treats a silence still open at the end as tail silence", () => {
    const stderr = "silence_start: 0\nsilence_end: 0.5 | silence_duration: 0.5\nsilence_start: 9.0\nRMS level dB: -20.0";
    expect(parseAnalysis(stderr, 10).tailSilenceSeconds).toBe(1);
  });

  it("reports no head or tail silence when the audio starts and ends with sound", () => {
    const stderr = "silence_start: 3\nsilence_end: 4 | silence_duration: 1\nRMS level dB: -19.5";
    expect(parseAnalysis(stderr, 10)).toMatchObject({ headSilenceSeconds: 0, tailSilenceSeconds: 0, rmsDb: -19.5 });
  });
});

describe("masteringPlan", () => {
  it("trims silence with a small cushion and gains to the RMS target", () => {
    const plan = masteringPlan(measurement());
    expect(plan.trimStartSeconds).toBeCloseTo(0.267, 3);
    expect(plan.trimEndSeconds).toBeCloseTo(12.41, 3);
    expect(plan.gainDb).toBeCloseTo(-2.7, 3);
  });

  it("caps extreme gain and rejects silent files", () => {
    expect(masteringPlan(measurement({ rmsDb: -70 })).gainDb).toBe(30);
    expect(() => masteringPlan(measurement({ rmsDb: null }))).toThrow("silent");
    expect(() => masteringPlan(measurement({ headSilenceSeconds: 13.16, tailSilenceSeconds: 13.16 }))).toThrow("silent");
  });
});

describe("masteringFilter", () => {
  it("builds the trim, level, limiter, and padding chain", () => {
    expect(masteringFilter({ trimStartSeconds: 0.267, trimEndSeconds: 12.41, gainDb: -2.7 })).toBe(
      [
        "atrim=start=0.267:end=12.410",
        "asetpts=PTS-STARTPTS",
        "aresample=44100",
        "volume=-2.70dB",
        "alimiter=limit=0.6310:level=0:attack=5:release=50",
        "adelay=750:all=1",
        "apad=pad_dur=2",
        "asetpts=N/SR/TB",
      ].join(","),
    );
  });
});
