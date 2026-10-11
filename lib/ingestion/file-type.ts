import { FILE_LIMITS, maxSizeForSourceType } from "@/lib/config/limits";
import {
  fileInvalid,
  fileTooLarge,
  fileTypeNotSupported,
} from "@/lib/api/errors";

export type SupportedSourceType = "EPUB" | "PDF" | "TXT";

const MIME_BY_TYPE: Record<SupportedSourceType, string[]> = {
  EPUB: ["application/epub+zip", "application/zip"],
  PDF: ["application/pdf"],
  TXT: ["text/plain"],
};

const EXT_BY_TYPE: Record<SupportedSourceType, "epub" | "pdf" | "txt"> = {
  EPUB: "epub",
  PDF: "pdf",
  TXT: "txt",
};

export function extensionForType(type: SupportedSourceType): "epub" | "pdf" | "txt" {
  return EXT_BY_TYPE[type];
}

export function canonicalMimeType(type: SupportedSourceType): string {
  return MIME_BY_TYPE[type][0];
}

export function detectSourceType(filename: string, mimeType: string): SupportedSourceType {
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  const mime = mimeType.toLowerCase();

  if (extension === "epub" || MIME_BY_TYPE.EPUB.includes(mime)) {
    return "EPUB";
  }
  if (extension === "pdf" || MIME_BY_TYPE.PDF.includes(mime)) {
    return "PDF";
  }
  if (extension === "txt" || MIME_BY_TYPE.TXT.includes(mime)) {
    return "TXT";
  }

  throw fileTypeNotSupported();
}

export function validateUploadRequest(input: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): { type: SupportedSourceType; mimeType: string } {
  const filename = input.filename.trim();
  if (!filename || filename.length > FILE_LIMITS.MAX_FILENAME_LENGTH) {
    throw fileInvalid("The filename is invalid.");
  }

  const type = detectSourceType(filename, input.mimeType);
  if (input.sizeBytes <= 0) {
    throw fileInvalid("The file is empty.");
  }
  if (input.sizeBytes > maxSizeForSourceType(type)) {
    throw fileTooLarge();
  }

  return { type, mimeType: canonicalMimeType(type) };
}
