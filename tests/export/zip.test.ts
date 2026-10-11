import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildChapterZip } from "@/lib/export/zip";

describe("mp3 zip export", () => {
  it("packages ordered chapter MP3s without re-encoding", async () => {
    const first = Buffer.from("ID3chapter-one");
    const second = Buffer.from("ID3chapter-two");
    const zipBuffer = await buildChapterZip({
      entries: [
        { filename: "01 - One.mp3", audio: first },
        { filename: "02 - Two.mp3", audio: second },
      ],
      metadataText: "Title: Demo",
    });

    const zip = await JSZip.loadAsync(zipBuffer);
    expect(await zip.file("01 - One.mp3")?.async("nodebuffer")).toEqual(first);
    expect(await zip.file("02 - Two.mp3")?.async("nodebuffer")).toEqual(second);
    expect(await zip.file("METADATA.txt")?.async("string")).toBe("Title: Demo");
  });
});
