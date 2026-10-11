export const FILE_LIMITS = {
  MAX_EPUB_SIZE: 50 * 1024 * 1024,
  MAX_PDF_SIZE: 30 * 1024 * 1024,
  MAX_TXT_SIZE: 5 * 1024 * 1024,
  MAX_FILENAME_LENGTH: 255,
  MAX_EXTRACTED_EPUB_SIZE: 80 * 1024 * 1024,
  MAX_EPUB_FILES: 2000,
  MAX_EPUB_ENTRY_SIZE: 8 * 1024 * 1024,
  MAX_CHAPTERS: 400,
  MAX_CHAPTER_TEXT_LENGTH: 200_000,
  MAX_TOTAL_EXTRACTED_TEXT: 2_000_000,
  PRESIGN_EXPIRES_SECONDS: 15 * 60,
  TTS_PREVIEW_MAX_CHARS: 400,
  TTS_PREVIEW_HOURLY_LIMIT: 20,
  AUDIO_SIGNED_URL_SECONDS: 10 * 60,
  COVER_SIGNED_URL_SECONDS: 10 * 60,
  EXPORT_SIGNED_URL_SECONDS: 10 * 60,
  MAX_COVER_SIZE: 5 * 1024 * 1024,
  MIN_COVER_DIMENSION: 200,
  MAX_COVER_DIMENSION: 4000,
  EXPORT_RETENTION_DAYS: readPositiveInt("EXPORT_RETENTION_DAYS", 7),
  EXPORT_FFMPEG_TIMEOUT_MS: readPositiveInt("EXPORT_FFMPEG_TIMEOUT_MS", 15 * 60 * 1000),
  MAX_CONCURRENT_EXPORT_JOBS_PER_USER: readPositiveInt(
    "MAX_CONCURRENT_EXPORT_JOBS_PER_USER",
    1,
  ),
  MAX_ANONYMOUS_PROJECTS: readPositiveInt("MAX_ANONYMOUS_PROJECTS", 1),
  MAX_ANONYMOUS_FILE_SIZE: readPositiveInt("MAX_ANONYMOUS_FILE_SIZE", 10 * 1024 * 1024),
  ANONYMOUS_TTS_SESSION_CHARS: readPositiveInt("ANONYMOUS_TTS_SESSION_CHARS", 1_000_000),
  ANONYMOUS_IP_DAILY_CHARS: readPositiveInt("ANONYMOUS_IP_DAILY_CHARS", 3_000_000),
  MAX_ANONYMOUS_PREVIEW_HOURLY: readPositiveInt("MAX_ANONYMOUS_PREVIEW_HOURLY", 5),
  MAX_ANONYMOUS_EXPORTS: readPositiveInt("MAX_ANONYMOUS_EXPORTS", 1),
  MAX_ANONYMOUS_CONCURRENT_JOBS: readPositiveInt("MAX_ANONYMOUS_CONCURRENT_JOBS", 1),
  ANONYMOUS_PROJECT_TTL_DAYS: readPositiveInt("ANONYMOUS_PROJECT_TTL_DAYS", 3),
  ANONYMOUS_RATE_LIMIT: readPositiveInt("ANONYMOUS_RATE_LIMIT", 10),
  ANONYMOUS_RATE_WINDOW_MS: readPositiveInt("ANONYMOUS_RATE_WINDOW_MS", 10 * 60 * 1000),
} as const;

export const TTS_SETTINGS = {
  EDGE_MAX_CONCURRENCY: readPositiveInt("EDGE_TTS_MAX_CONCURRENCY", 2),
  EDGE_MAX_CHARS_PER_REQUEST: readPositiveInt("EDGE_TTS_MAX_CHARS_PER_REQUEST", 3_000),
  EDGE_GLOBAL_DAILY_CHARS: readNonNegativeInt("EDGE_GLOBAL_DAILY_CHARS", 50_000_000),
  MINIMAX_MAX_CONCURRENCY: readPositiveInt("MINIMAX_MAX_CONCURRENCY", 2),
  OPENAI_MAX_CONCURRENCY: readPositiveInt("OPENAI_TTS_MAX_CONCURRENCY", 2),
  MAX_TTS_JOB_COST_USD: readPositiveNumber("MAX_TTS_JOB_COST_USD", 10),
  DAILY_PREMIUM_COST_LIMIT_USD: readPositiveNumber("DAILY_PREMIUM_COST_LIMIT_USD", 100),
  CACHE_RETENTION_DAYS: readPositiveInt("TTS_CACHE_RETENTION_DAYS", 30),
  MAX_CHARS_PER_AUDIO_SECOND: readPositiveNumber("TTS_MAX_CHARS_PER_AUDIO_SECOND", 45),
} as const;

export function isFeatureEnabled(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  return raw === "true" || raw === "1";
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readNonNegativeInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function maxSizeForSourceType(type: "EPUB" | "PDF" | "TXT"): number {
  if (type === "EPUB") {
    return FILE_LIMITS.MAX_EPUB_SIZE;
  }
  if (type === "PDF") {
    return FILE_LIMITS.MAX_PDF_SIZE;
  }
  return FILE_LIMITS.MAX_TXT_SIZE;
}
