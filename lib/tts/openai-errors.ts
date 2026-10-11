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
  error?: { code?: string; type?: string; message?: string };
  message?: string;
};

export function mapOpenAIError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const shaped = error as ProviderErrorShape;
  const status = shaped.status ?? shaped.statusCode;
  const code = `${shaped.code ?? shaped.error?.code ?? ""}`.toLowerCase();
  const type = `${shaped.error?.type ?? ""}`.toLowerCase();
  const message = `${shaped.error?.message ?? shaped.message ?? ""}`.toLowerCase();

  if (status === 429 || code.includes("rate_limit")) {
    return ttsRateLimited();
  }
  if (isContentRejected(code, type, message)) {
    return ttsContentRejected();
  }
  if (status === 400 || status === 422 || code.includes("invalid")) {
    return ttsInvalidRequest();
  }
  if (status === 401 || status === 403 || (status !== undefined && status >= 500)) {
    return ttsProviderUnavailable();
  }
  return ttsGenerationFailed();
}

function isContentRejected(code: string, type: string, message: string): boolean {
  return (
    code.includes("content_policy") ||
    code.includes("policy_violation") ||
    type.includes("policy") ||
    message.includes("content policy") ||
    message.includes("safety")
  );
}
