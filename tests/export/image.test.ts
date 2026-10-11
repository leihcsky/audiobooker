import { describe, expect, it } from "vitest";
import { fileInvalid, fileTooLarge, fileTypeNotSupported } from "@/lib/api/errors";
import { detectCoverImage, validateCoverImage } from "@/lib/export/image";

function pngWithSize(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.write("\u0089PNG\r\n\u001a\n", 0, "binary");
  buffer.write("IHDR", 12);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

describe("cover image detection", () => {
  it("reads PNG dimensions from IHDR", () => {
    expect(detectCoverImage(pngWithSize(640, 480))).toEqual({
      kind: "png",
      contentType: "image/png",
      dimensions: { width: 640, height: 480 },
    });
  });

  it("rejects unsupported bytes", () => {
    expect(detectCoverImage(Buffer.from("not-an-image"))).toBeNull();
  });
});

describe("cover validation", () => {
  it("rejects images below the minimum dimension", () => {
    expect(() => validateCoverImage(pngWithSize(100, 100))).toThrow(/at least/);
  });

  it("rejects images above the maximum dimension", () => {
    expect(() => validateCoverImage(pngWithSize(5000, 5000))).toThrow(/at most/);
  });

  it("rejects empty files", () => {
    expect(() => validateCoverImage(Buffer.alloc(0))).toThrow(fileInvalid("The cover image is empty."));
  });

  it("rejects unsupported types", () => {
    expect(() => validateCoverImage(Buffer.from("GIF89a"))).toThrow(fileTypeNotSupported());
  });

  it("rejects oversized files", () => {
    const huge = Buffer.alloc(6 * 1024 * 1024, 1);
    huge.write("\u0089PNG\r\n\u001a\n", 0, "binary");
    expect(() => validateCoverImage(huge)).toThrow(fileTooLarge());
  });

  it("accepts a valid PNG", () => {
    expect(validateCoverImage(pngWithSize(400, 400)).kind).toBe("png");
  });
});
