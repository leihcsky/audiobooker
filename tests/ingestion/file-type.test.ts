import { describe, expect, it } from "vitest";
import { FILE_LIMITS } from "@/lib/config/limits";
import { validateUploadRequest } from "@/lib/ingestion/file-type";

describe("upload validation", () => {
  it("accepts an epub upload", () => {
    expect(
      validateUploadRequest({
        filename: "book.epub",
        mimeType: "application/epub+zip",
        sizeBytes: 1024,
      }).type,
    ).toBe("EPUB");
  });

  it("rejects unsupported types", () => {
    expect(() =>
      validateUploadRequest({
        filename: "book.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 1024,
      }),
    ).toThrowError(/FILE_TYPE_NOT_SUPPORTED|not supported/);
  });

  it("rejects oversized files", () => {
    expect(() =>
      validateUploadRequest({
        filename: "book.txt",
        mimeType: "text/plain",
        sizeBytes: FILE_LIMITS.MAX_TXT_SIZE + 1,
      }),
    ).toThrowError(/FILE_TOO_LARGE|too large/);
  });
});
