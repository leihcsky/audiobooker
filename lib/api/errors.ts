import { NARRATION_BUSY_MESSAGE, NARRATION_GENERIC_FAILURE } from "@/lib/tts/narration-failure";

export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export function unauthenticated(): AppError {
  return new AppError(
    "UNAUTHENTICATED",
    "Authentication required.",
    401,
  );
}

export function forbidden(message = "You do not have access to this resource."): AppError {
  return new AppError("FORBIDDEN", message, 403);
}

export function projectNotFound(): AppError {
  return new AppError("PROJECT_NOT_FOUND", "Project not found.", 404);
}

export function validationError(message: string): AppError {
  return new AppError("VALIDATION_ERROR", message, 422);
}

export function conflict(message: string): AppError {
  return new AppError("CONFLICT", message, 409);
}

export function fileTypeNotSupported(): AppError {
  return new AppError("FILE_TYPE_NOT_SUPPORTED", "This file type is not supported.", 415);
}

export function fileTooLarge(): AppError {
  return new AppError("FILE_TOO_LARGE", "The file is too large.", 413);
}

export function fileInvalid(message = "The file is invalid."): AppError {
  return new AppError("FILE_INVALID", message, 400);
}

export function fileNotFound(): AppError {
  return new AppError("FILE_NOT_FOUND", "The uploaded file was not found.", 404);
}

export function uploadFailed(): AppError {
  return new AppError("UPLOAD_FAILED", "The file upload could not be completed.", 400);
}

export function sourceFileNotFound(): AppError {
  return new AppError("SOURCE_FILE_NOT_FOUND", "Source file not found.", 404);
}

export function sourceFileAlreadyProcessing(): AppError {
  return new AppError(
    "SOURCE_FILE_ALREADY_PROCESSING",
    "This source file is already being parsed.",
    409,
  );
}

export function parseFailed(message = "We couldn't process this file."): AppError {
  return new AppError("PARSE_FAILED", message, 422);
}

export function chapterNotFound(): AppError {
  return new AppError("CHAPTER_NOT_FOUND", "Chapter not found.", 404);
}

export function audioNotFound(): AppError {
  return new AppError("AUDIO_NOT_FOUND", "This chapter does not have generated audio yet.", 404);
}

export function usageLimitExceeded(): AppError {
  return new AppError(
    "USAGE_LIMIT_EXCEEDED",
    "This month's narration limit has been reached.",
    429,
  );
}

export function ttsVoiceNotFound(): AppError {
  return new AppError("TTS_VOICE_NOT_FOUND", "That voice is not available.", 404);
}

export function ttsInvalidRequest(message = "The narration request is invalid."): AppError {
  return new AppError("TTS_INVALID_REQUEST", message, 400);
}

export function ttsRateLimited(): AppError {
  return new AppError(
    "TTS_RATE_LIMITED",
    "Narration is temporarily rate limited. Please try again shortly.",
    429,
  );
}

export function ttsProviderUnavailable(): AppError {
  return new AppError(
    "TTS_PROVIDER_UNAVAILABLE",
    "The narration service isn't available right now. Finished chapters are saved. Try again in a few minutes.",
    503,
  );
}

export function ttsProviderBusy(): AppError {
  return new AppError("TTS_PROVIDER_BUSY", NARRATION_BUSY_MESSAGE, 503);
}

export function ttsProviderTimeout(): AppError {
  return new AppError(
    "TTS_PROVIDER_TIMEOUT",
    "The narration service took too long to respond. Finished chapters are saved. Try again in a moment.",
    504,
  );
}

export function ttsAudioInvalid(): AppError {
  return new AppError("TTS_AUDIO_INVALID", NARRATION_GENERIC_FAILURE, 502);
}

export function ttsAudioTruncated(): AppError {
  return new AppError("TTS_AUDIO_TRUNCATED", NARRATION_GENERIC_FAILURE, 502);
}

export function ttsPremiumNotAvailable(
  message = "Premium voices aren't available right now. Choose a standard voice to continue.",
): AppError {
  return new AppError("TTS_PREMIUM_NOT_AVAILABLE", message, 403);
}

export function ttsPremiumQuotaExceeded(
  message = "Your premium minutes are used up. Buy more minutes or choose a standard voice.",
): AppError {
  return new AppError("TTS_PREMIUM_QUOTA_EXCEEDED", message, 429);
}

export function planRequired(message: string): AppError {
  return new AppError("PLAN_REQUIRED", message, 403);
}

export function billingUnavailable(): AppError {
  return new AppError(
    "BILLING_UNAVAILABLE",
    "Checkout isn't available right now. Please try again in a few minutes.",
    503,
  );
}

export function checkoutRateLimited(): AppError {
  return new AppError(
    "CHECKOUT_RATE_LIMITED",
    "Too many checkout attempts. Please try again later.",
    429,
  );
}

export function invalidWebhookSignature(): AppError {
  return new AppError("INVALID_SIGNATURE", "Invalid signature.", 401);
}

export function ttsCostLimitExceeded(
  message = "This chapter is too large for premium narration right now. Choose a standard voice or try a shorter chapter.",
): AppError {
  return new AppError("TTS_COST_LIMIT_EXCEEDED", message, 422);
}

export function ttsCapacityReached(): AppError {
  return new AppError(
    "TTS_CAPACITY_REACHED",
    "Standard narration has reached today's capacity. Finished chapters are saved. Please try again tomorrow.",
    503,
  );
}

export function ttsContentRejected(): AppError {
  return new AppError(
    "TTS_CONTENT_REJECTED",
    "We couldn't generate this chapter. Please try again.",
    422,
  );
}

export function ttsGenerationFailed(): AppError {
  return new AppError("TTS_GENERATION_FAILED", NARRATION_GENERIC_FAILURE, 502);
}

export function chapterAlreadyGenerating(): AppError {
  return new AppError(
    "CHAPTER_ALREADY_GENERATING",
    "This chapter is already being generated.",
    409,
  );
}

export function exportInvalidProject(
  message = "This project is not ready to export.",
): AppError {
  return new AppError("EXPORT_INVALID_PROJECT", message, 422);
}

export function exportAudioIncomplete(
  message = "Some chapters do not have generated audio.",
): AppError {
  return new AppError("EXPORT_AUDIO_INCOMPLETE", message, 422);
}

export function exportAudioNotFound(): AppError {
  return new AppError("EXPORT_AUDIO_NOT_FOUND", "Chapter audio could not be found.", 404);
}

export function exportAudioInvalid(): AppError {
  return new AppError("EXPORT_AUDIO_INVALID", "Chapter audio is invalid.", 422);
}

export function exportMetadataInvalid(message = "Audiobook metadata is invalid."): AppError {
  return new AppError("EXPORT_METADATA_INVALID", message, 422);
}

export function pronunciationNotFound(): AppError {
  return new AppError("PRONUNCIATION_NOT_FOUND", "Pronunciation entry not found.", 404);
}

export function pronunciationDuplicate(): AppError {
  return new AppError("PRONUNCIATION_DUPLICATE", "This word is already in the dictionary.", 409);
}

export function pronunciationLimitReached(limit: number): AppError {
  return new AppError(
    "PRONUNCIATION_LIMIT_REACHED",
    `A project can have up to ${limit} pronunciation entries.`,
    422,
  );
}

export function paragraphNotFound(): AppError {
  return new AppError("PARAGRAPH_NOT_FOUND", "Paragraph not found.", 404);
}

export function exportNotFound(): AppError {
  return new AppError("EXPORT_NOT_FOUND", "Export not found.", 404);
}

export function exportNotReady(): AppError {
  return new AppError("EXPORT_NOT_READY", "This export is not ready to download.", 409);
}

export function exportExpired(): AppError {
  return new AppError("EXPORT_EXPIRED", "This export has expired.", 410);
}

export function exportBusy(): AppError {
  return new AppError(
    "EXPORT_BUSY",
    "An export is already in progress. Please wait for it to finish.",
    409,
  );
}

export function exportProcessingFailed(
  message = "We couldn't export this audiobook. Please try again.",
): AppError {
  return new AppError("EXPORT_PROCESSING_FAILED", message, 502);
}

export function exportTimeout(): AppError {
  return new AppError("EXPORT_TIMEOUT", "The export timed out. Please try again.", 504);
}

export function coverNotFound(): AppError {
  return new AppError("COVER_NOT_FOUND", "This project does not have a cover image.", 404);
}

export function sessionExpired(): AppError {
  return new AppError("SESSION_EXPIRED", "This free-tool session has expired.", 401);
}

export function generationLimitReached(
  message = "The free narration limit has been reached. Save the project to continue.",
): AppError {
  return new AppError("GENERATION_LIMIT_REACHED", message, 429);
}
