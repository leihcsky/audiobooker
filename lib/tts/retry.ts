import { AppError } from "@/lib/api/errors";

export const TTS_RETRY_DELAYS_MS = [1_000, 3_000, 10_000] as const;

const RETRYABLE_CODES = new Set([
  "TTS_PROVIDER_UNAVAILABLE",
  "TTS_PROVIDER_BUSY",
  "TTS_PROVIDER_TIMEOUT",
  "TTS_RATE_LIMITED",
  "TTS_AUDIO_INVALID",
  "TTS_AUDIO_TRUNCATED",
  "TTS_GENERATION_FAILED",
]);

export function isRetryableTtsError(error: unknown): boolean {
  return error instanceof AppError && RETRYABLE_CODES.has(error.code);
}

export type RetryOptions = {
  delaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
};

/**
 * Runs `task` and retries transient TTS failures with the configured delays
 * plus up to 30% jitter. Permanent errors (invalid voice, invalid request,
 * quota) are rethrown immediately.
 */
export async function withTtsRetry<T>(task: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const delays = options.delaysMs ?? TTS_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= delays.length || !isRetryableTtsError(error)) {
        throw error;
      }
      const base = delays[attempt] ?? 0;
      const delayMs = Math.round(base * (1 + random() * 0.3));
      options.onRetry?.({ attempt: attempt + 1, delayMs, error });
      await sleep(delayMs);
    }
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
