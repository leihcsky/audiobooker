import { describeWithDisclosure } from "@/lib/publish/disclosure";

export type AudiobookMetadata = {
  title: string;
  author: string | null;
  narrator: string | null;
  language: string;
  description: string | null;
  publisher: string | null;
  copyright: string | null;
  aiDisclosure: string;
};

export type ChapterMarker = {
  title: string;
  startMs: number;
  endMs: number;
};

export function escapeFfmetadata(value: string): string {
  return value.replace(/[\\=;#\n\r]/g, (character) => `\\${character}`);
}

export function buildFfmetadata(input: {
  metadata: AudiobookMetadata;
  chapters: ChapterMarker[];
}): string {
  const lines = [
    ";FFMETADATA1",
    `title=${escapeFfmetadata(input.metadata.title)}`,
    `album=${escapeFfmetadata(input.metadata.title)}`,
    `genre=Audiobook`,
  ];

  if (input.metadata.author) {
    lines.push(`artist=${escapeFfmetadata(input.metadata.author)}`);
    lines.push(`album_artist=${escapeFfmetadata(input.metadata.author)}`);
  }
  if (input.metadata.narrator) {
    lines.push(`composer=${escapeFfmetadata(input.metadata.narrator)}`);
  }
  lines.push(
    `comment=${escapeFfmetadata(describeWithDisclosure(input.metadata.description, input.metadata.aiDisclosure))}`,
  );
  if (input.metadata.publisher) {
    lines.push(`publisher=${escapeFfmetadata(input.metadata.publisher)}`);
  }
  if (input.metadata.copyright) {
    lines.push(`copyright=${escapeFfmetadata(input.metadata.copyright)}`);
  }
  if (input.metadata.language) {
    lines.push(`language=${escapeFfmetadata(input.metadata.language)}`);
  }

  for (const chapter of input.chapters) {
    lines.push("[CHAPTER]");
    lines.push("TIMEBASE=1/1000");
    lines.push(`START=${chapter.startMs}`);
    lines.push(`END=${chapter.endMs}`);
    lines.push(`title=${escapeFfmetadata(chapter.title)}`);
  }

  return `${lines.join("\n")}\n`;
}

export function buildMetadataText(metadata: AudiobookMetadata): string {
  return [
    `Title: ${metadata.title}`,
    `Author: ${metadata.author ?? ""}`,
    `Narrator: ${metadata.narrator ?? ""}`,
    `Language: ${metadata.language}`,
    `Publisher: ${metadata.publisher ?? ""}`,
    `Copyright: ${metadata.copyright ?? ""}`,
    `Description: ${metadata.description ?? ""}`,
    `AI narration disclosure: ${metadata.aiDisclosure}`,
  ].join("\n");
}

export function buildConcatList(filenames: string[]): string {
  return filenames.map((filename) => `file '${filename.replace(/'/g, "'\\''")}'`).join("\n");
}
