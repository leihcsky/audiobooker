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
