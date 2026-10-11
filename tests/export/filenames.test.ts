import { describe, expect, it } from "vitest";
import { attachmentDisposition, chapterZipEntryName, sanitizeFilename } from "@/lib/export/filenames";

describe("export filenames", () => {
  it("removes path and reserved characters", () => {
    expect(sanitizeFilename('Ch 1: "Intro"/../ok?.mp3', "Chapter")).toBe("Ch 1 Intro ok .mp3");
  });

  it("falls back when the title is empty", () => {
    expect(sanitizeFilename("   ", "Chapter")).toBe("Chapter");
  });

  it("builds deterministic chapter zip names", () => {
    expect(chapterZipEntryName(1, "Introduction")).toBe("01 - Introduction.mp3");
  });

  it("forces an attachment download with an ASCII fallback and UTF-8 name", () => {
    expect(attachmentDisposition("My Book.m4b")).toBe(
      `attachment; filename="My Book.m4b"; filename*=UTF-8''My%20Book.m4b`,
    );
    expect(attachmentDisposition('三体 "1".m4b')).toBe(
      `attachment; filename="__ 1 .m4b"; filename*=UTF-8''%E4%B8%89%E4%BD%93%201%20.m4b`,
    );
  });
});
