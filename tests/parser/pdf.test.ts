import { describe, expect, it } from "vitest";
import { pdfParser } from "@/lib/parser/pdf";

describe("pdf parser", () => {
  it("rejects files that are not PDFs", async () => {
    await expect(
      pdfParser.parse({
        filename: "notes.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("not a pdf"),
      }),
    ).rejects.toMatchObject({ code: "FILE_INVALID" });
  });
});
