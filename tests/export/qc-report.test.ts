import { describe, expect, it } from "vitest";
import type { AudioMeasurement } from "@/lib/audio/mastering-preset";
import { buildOpeningCreditsText } from "@/lib/export/opening-credits";
import { buildQcCsv, buildQcReport, evaluateQcChecks, parseQcReport, qcFileResult } from "@/lib/export/qc-report";

function mastered(overrides: Partial<AudioMeasurement> = {}): AudioMeasurement {
  return {
    durationSeconds: 600,
    rmsDb: -20.4,
    peakDb: -6.1,
    noiseFloorDb: null,
    headSilenceSeconds: 0.77,
    tailSilenceSeconds: 2.05,
    bitrateKbps: 192,
    sampleRateHz: 44_100,
    ...overrides,
  };
}

describe("evaluateQcChecks", () => {
  it("passes a file mastered to the preset", () => {
    expect(Object.values(evaluateQcChecks(mastered())).every(Boolean)).toBe(true);
  });

  it("flags each spec violation separately", () => {
    expect(evaluateQcChecks(mastered({ rmsDb: -25 })).rms).toBe(false);
    expect(evaluateQcChecks(mastered({ rmsDb: null })).rms).toBe(false);
    expect(evaluateQcChecks(mastered({ peakDb: -2.5 })).peak).toBe(false);
    expect(evaluateQcChecks(mastered({ noiseFloorDb: -50 })).noiseFloor).toBe(false);
    expect(evaluateQcChecks(mastered({ headSilenceSeconds: 0.2 })).head).toBe(false);
    expect(evaluateQcChecks(mastered({ tailSilenceSeconds: 6 })).tail).toBe(false);
    expect(evaluateQcChecks(mastered({ bitrateKbps: 48, sampleRateHz: 24_000 })).format).toBe(false);
    expect(evaluateQcChecks(mastered({ durationSeconds: 121 * 60 })).length).toBe(false);
  });
});

describe("buildQcReport", () => {
  it("fails the package when a file fails or the credits are missing", () => {
    const good = qcFileResult({ name: "01 - One.mp3", title: "One", measurement: mastered() });
    const bad = qcFileResult({ name: "02 - Two.mp3", title: "Two", measurement: mastered({ peakDb: -1 }) });
    const credits = { included: true, voiceId: "edge-en-us-aria" };

    expect(buildQcReport({ files: [good], openingCredits: credits }).verdict).toBe("pass");
    expect(buildQcReport({ files: [good, bad], openingCredits: credits }).verdict).toBe("fail");
    expect(buildQcReport({ files: [good], openingCredits: { included: false, voiceId: null } }).verdict).toBe("fail");
    expect(buildQcReport({ files: [good, good], openingCredits: credits }).totalDurationSeconds).toBe(1200);
  });

  it("round-trips through parseQcReport and rejects foreign JSON", () => {
    const report = buildQcReport({
      files: [qcFileResult({ name: "a.mp3", title: "A", measurement: mastered() })],
      openingCredits: { included: true, voiceId: null },
    });
    expect(parseQcReport(JSON.parse(JSON.stringify(report)))).toEqual(report);
    expect(parseQcReport(null)).toBeNull();
    expect(parseQcReport({ preset: "publish-v1", verdict: "maybe", files: [] })).toBeNull();
  });
});

describe("buildQcCsv", () => {
  it("writes a summary, a header, and one quoted row per file", () => {
    const report = buildQcReport({
      files: [qcFileResult({ name: 'Ch, "One".mp3', title: "One", measurement: mastered({ peakDb: -1 }) })],
      openingCredits: { included: false, voiceId: null },
    });
    const lines = buildQcCsv(report).trimEnd().split("\r\n");
    expect(lines.slice(0, 3)).toEqual(["# Preset: publish-v1", "# Verdict: fail", "# Opening credits: missing"]);
    expect(lines[3]).toContain("RMS (dB)");
    expect(lines[4].startsWith('"Ch, ""One"".mp3",600.0,-20.4,-1.0,-inf,0.77,2.05,192,44100')).toBe(true);
    expect(lines[4].endsWith(",fail")).toBe(true);
  });
});

describe("buildOpeningCreditsText", () => {
  it("names title, author, and narrator, calling the default credit a digital voice", () => {
    expect(
      buildOpeningCreditsText({ title: "My Book", author: "Jane Doe", narrator: "Digital voice", language: "en-US" }),
    ).toBe("My Book. Written by Jane Doe. Narrated by a digital voice.");
    expect(buildOpeningCreditsText({ title: "Mi libro", author: null, narrator: "Ana", language: "es" })).toBe(
      "Mi libro. Narrado por Ana.",
    );
  });

  it("uses CJK punctuation for Chinese and falls back to English for other languages", () => {
    expect(buildOpeningCreditsText({ title: "我的书", author: "张三", narrator: null, language: "zh-CN" })).toBe(
      "我的书。作者：张三。朗读：数字语音。",
    );
    expect(buildOpeningCreditsText({ title: "Kitap", author: "Ali", narrator: "Veli", language: "tr" })).toBe(
      "Kitap. Written by Ali. Narrated by Veli.",
    );
  });
});
