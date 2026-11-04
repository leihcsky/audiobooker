import {
  AppError,
  ttsContentRejected,
  ttsGenerationFailed,
  ttsInvalidRequest,
  ttsProviderUnavailable,
  ttsRateLimited,
} from "@/lib/api/errors";

type ProviderErrorShape = {
  status?: number;
  statusCode?: number;
  code?: string;
  detail?: string;
  message?: string;
  error?: { code?: string; message?: string; status?: string };
};

export function mapElevenLabsError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const shaped = error as ProviderErrorShape;
  const status = shaped.status ?? shaped.statusCode;
  const text = [
    shaped.code,
    shaped.detail,
    shaped.message,
    shaped.error?.code,
    shaped.error?.message,
    shaped.error?.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (status === 429 || text.includes("rate_limit") || text.includes("quota")) {
    return ttsRateLimited();
  }
  if (
    text.includes("content") &&
    (text.includes("policy") || text.includes("moderation") || text.includes("blocked"))
  ) {
    return ttsContentRejected();
  }
  if (status === 400 || status === 422 || text.includes("invalid") || text.includes("validation")) {
    return ttsInvalidRequest();
  }
  if (status === 401 || status === 403 || (status !== undefined && status >= 500)) {
    return ttsProviderUnavailable();
  }
  return ttsGenerationFailed();
}
