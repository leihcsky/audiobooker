import { ownerPrefix, type StorageOwner } from "@/lib/tools/storage-owner";

const OWNER = "(users|anonymous)";
const UUID = "([0-9a-f-]{36})";

const SOURCE_KEY = new RegExp(
  `^${OWNER}\\/${UUID}\\/projects\\/${UUID}\\/sources\\/${UUID}\\/original\\.(epub|pdf|txt)$`,
  "i",
);

export type SourceObjectKeyParts = {
  owner: StorageOwner;
  projectId: string;
  sourceFileId: string;
  extension: "epub" | "pdf" | "txt";
};

export function buildSourceObjectKey(parts: SourceObjectKeyParts): string {
  return `${ownerPrefix(parts.owner)}/projects/${parts.projectId}/sources/${parts.sourceFileId}/original.${parts.extension}`;
}

export function parseSourceObjectKey(objectKey: string): SourceObjectKeyParts | null {
  const match = SOURCE_KEY.exec(objectKey);
  if (!match) {
    return null;
  }
  return {
    owner: {
      kind: match[1].toLowerCase() === "anonymous" ? "anonymous" : "user",
      id: match[2],
    },
    projectId: match[3],
    sourceFileId: match[4],
    extension: match[5].toLowerCase() as SourceObjectKeyParts["extension"],
  };
}

const AUDIO_KEY = new RegExp(
  `^${OWNER}\\/${UUID}\\/projects\\/${UUID}\\/chapters\\/${UUID}\\/audio\\/${UUID}\\/audio\\.mp3$`,
  "i",
);
const PREVIEW_KEY = new RegExp(`^${OWNER}\\/${UUID}\\/previews\\/([a-z0-9-]+)\\.mp3$`, "i");

export type ChapterAudioObjectKeyParts = {
  owner: StorageOwner;
  projectId: string;
  chapterId: string;
  audioFileId: string;
};

export type PreviewObjectKeyParts = {
  owner: StorageOwner;
  voiceId: string;
};

export function buildChapterAudioObjectKey(parts: ChapterAudioObjectKeyParts): string {
  return `${ownerPrefix(parts.owner)}/projects/${parts.projectId}/chapters/${parts.chapterId}/audio/${parts.audioFileId}/audio.mp3`;
}

export function parseChapterAudioObjectKey(objectKey: string): ChapterAudioObjectKeyParts | null {
  const match = AUDIO_KEY.exec(objectKey);
  if (!match) {
    return null;
  }
  return {
    owner: {
      kind: match[1].toLowerCase() === "anonymous" ? "anonymous" : "user",
      id: match[2],
    },
    projectId: match[3],
    chapterId: match[4],
    audioFileId: match[5],
  };
}

export function buildPreviewObjectKey(parts: PreviewObjectKeyParts): string {
  return `${ownerPrefix(parts.owner)}/previews/${parts.voiceId}.mp3`;
}

export function parsePreviewObjectKey(objectKey: string): PreviewObjectKeyParts | null {
  const match = PREVIEW_KEY.exec(objectKey);
  if (!match) {
    return null;
  }
  return {
    owner: {
      kind: match[1].toLowerCase() === "anonymous" ? "anonymous" : "user",
      id: match[2],
    },
    voiceId: match[3],
  };
}

const COVER_KEY = new RegExp(
  `^${OWNER}\\/${UUID}\\/projects\\/${UUID}\\/cover\\/cover\\.(jpg|png|webp)$`,
  "i",
);
const EXPORT_KEY = new RegExp(
  `^${OWNER}\\/${UUID}\\/projects\\/${UUID}\\/exports\\/${UUID}\\/(audiobook\\.m4b|chapters\\.zip)$`,
  "i",
);

export type CoverObjectKeyParts = {
  owner: StorageOwner;
  projectId: string;
  extension: "jpg" | "png" | "webp";
};

export type ExportObjectKeyParts = {
  owner: StorageOwner;
  projectId: string;
  exportId: string;
  filename: "audiobook.m4b" | "chapters.zip";
};

export function buildCoverObjectKey(parts: CoverObjectKeyParts): string {
  return `${ownerPrefix(parts.owner)}/projects/${parts.projectId}/cover/cover.${parts.extension}`;
}

export function parseCoverObjectKey(objectKey: string): CoverObjectKeyParts | null {
  const match = COVER_KEY.exec(objectKey);
  if (!match) {
    return null;
  }
  return {
    owner: {
      kind: match[1].toLowerCase() === "anonymous" ? "anonymous" : "user",
      id: match[2],
    },
    projectId: match[3],
    extension: match[4].toLowerCase() as CoverObjectKeyParts["extension"],
  };
}

export function buildExportObjectKey(parts: ExportObjectKeyParts): string {
  return `${ownerPrefix(parts.owner)}/projects/${parts.projectId}/exports/${parts.exportId}/${parts.filename}`;
}

export function parseExportObjectKey(objectKey: string): ExportObjectKeyParts | null {
  const match = EXPORT_KEY.exec(objectKey);
  if (!match) {
    return null;
  }
  return {
    owner: {
      kind: match[1].toLowerCase() === "anonymous" ? "anonymous" : "user",
      id: match[2],
    },
    projectId: match[3],
    exportId: match[4],
    filename: match[5].toLowerCase() as ExportObjectKeyParts["filename"],
  };
}
