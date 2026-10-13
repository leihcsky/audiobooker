const MESSAGE_FROM_API = new Set([
  "TTS_PREMIUM_NOT_AVAILABLE",
  "TTS_PREMIUM_QUOTA_EXCEEDED",
  "TTS_COST_LIMIT_EXCEEDED",
  "TTS_CAPACITY_REACHED",
  "CONFLICT",
  "VALIDATION_ERROR",
  "PLAN_REQUIRED",
  "PARAGRAPH_NOT_FOUND",
]);

export function userFacingTtsError(code?: string, message?: string): string {
  if (code && MESSAGE_FROM_API.has(code) && message) {
    return message;
  }
  if (code === "USAGE_LIMIT_EXCEEDED") {
    return "This month's narration limit has been reached.";
  }
  if (code === "TTS_VOICE_NOT_FOUND") {
    return "That voice is not available.";
  }
  if (code === "TTS_RATE_LIMITED") {
    return "Narration is temporarily rate limited. Please try again shortly.";
  }
  if (code === "TTS_PROVIDER_BUSY" || code === "TTS_PROVIDER_UNAVAILABLE" || code === "TTS_PROVIDER_TIMEOUT") {
    return "The narration service is busy. Wait a minute, then try again.";
  }
  return "We couldn't generate this chapter. Please try again.";
}
