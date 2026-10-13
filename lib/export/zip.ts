import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import JSZip from "jszip";

export async function buildChapterZip(input: {
  entries: { filename: string; audio: Buffer }[];
  metadataText?: string;
}): Promise<Buffer> {
  const zip = new JSZip();
  for (const entry of input.entries) {
    zip.file(entry.filename, entry.audio);
  }
  if (input.metadataText) {
    zip.file("METADATA.txt", input.metadataText);
  }
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/** Streams files from disk into a ZIP on disk; MP3 entries are stored, not deflated. */
export async function writeZipFile(input: {
  files: { filename: string; path: string }[];
  texts: { filename: string; content: string }[];
  outputPath: string;
}): Promise<void> {
  const zip = new JSZip();
  for (const file of input.files) {
    zip.file(file.filename, createReadStream(file.path), { binary: true, compression: "STORE" });
  }
  for (const text of input.texts) {
    zip.file(text.filename, text.content, { compression: "DEFLATE" });
  }
  await pipeline(
    zip.generateNodeStream({ type: "nodebuffer", streamFiles: true }),
    createWriteStream(input.outputPath),
  );
}
