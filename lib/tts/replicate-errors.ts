import {
  AppError,
  ttsContentRejected,
  ttsGenerationFailed,
  ttsInvalidRequest,
  ttsProviderBusy,
  ttsProviderUnavailable,
  ttsRateLimited,
} from "@/lib/api/errors";

type ProviderErrorShape = {
  status?: number;
  statusCode?: number;
  code?: string;
  error?: { code?: string; type?: string; message?: string; detail?: string };
  message?: string;
  detail?: string;
};

export function mapReplicateError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const shaped = error as ProviderErrorShape;
  const status = shaped.status ?? shaped.statusCode;
  const text = collectErrorText(error);

  if (status === 429 || text.includes("rate limit")) {
    return ttsRateLimited();
  }
  if (isProviderBusy(text)) {
    return ttsProviderBusy();
  }
  if (isContentRejected(text)) {
    return ttsContentRejected();
  }
  if (status === 400 || status === 422 || text.includes("invalid")) {
    return ttsInvalidRequest();
  }
  if (status === 401 || status === 403 || (status !== undefined && status >= 500)) {
    return ttsProviderUnavailable();
  }
  if (text.includes("unauthenticated") || text.includes("not configured")) {
    return ttsProviderUnavailable();
  }
  return ttsGenerationFailed();
}

function collectErrorText(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  const walk = (value: unknown, depth: number) => {
    if (value == null || depth > 5 || seen.has(value)) {
      return;
    }
    if (typeof value === "string" || typeof value === "number") {
      parts.push(String(value));
      return;
    }
    if (typeof value !== "object") {
      return;
    }
    seen.add(value);
    if (value instanceof Error) {
      parts.push(value.name, value.message);
      walk(value.cause, depth + 1);
      return;
    }
    const record = value as Record<string, unknown>;
    for (const key of ["message", "detail", "error", "code", "title", "status", "statusText"]) {
      walk(record[key], depth + 1);
    }
  };
  walk(error, 0);
  try {
    parts.push(JSON.stringify(error));
  } catch {
    parts.push(String(error));
  }
  return parts.join(" ").toLowerCase();
}

function isProviderBusy(text: string): boolean {
  return text.includes("e003") || text.includes("high demand") || text.includes("currently unavailable");
}

function isContentRejected(text: string): boolean {
  return (
    text.includes("content_policy") ||
    text.includes("policy_violation") ||
    text.includes("content policy") ||
    text.includes("safety") ||
    text.includes("nsfw")
  );
}
