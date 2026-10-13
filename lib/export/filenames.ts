const UNSAFE_FILENAME = /[/\\:*?"<>|\u0000-\u001f]/g;

export function sanitizeFilename(value: string, fallback: string): string {
  const cleaned = value
    .replace(UNSAFE_FILENAME, " ")
    .replace(/\.\./g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 120)
    .trim();

  return cleaned.length > 0 ? cleaned : fallback;
}

export function chapterZipEntryName(orderIndex: number, title: string): string {
  const prefix = String(orderIndex).padStart(2, "0");
  return `${prefix} - ${sanitizeFilename(title, "Chapter")}.mp3`;
}

export function exportZipFilename(title: string, options: { publishReady?: boolean } = {}): string {
  const base = sanitizeFilename(title, "audiobook");
  return options.publishReady ? `${base} - publish-ready.zip` : `${base}.zip`;
}

export function exportM4bFilename(title: string): string {
  return `${sanitizeFilename(title, "audiobook")}.m4b`;
}

/** RFC 6266 header with an ASCII fallback plus the UTF-8 name for non-Latin titles. */
export function attachmentDisposition(filename: string): string {
  const safe = sanitizeFilename(filename, "download");
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_").replace(/[%;]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRFC5987(safe)}`;
}

function encodeRFC5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
