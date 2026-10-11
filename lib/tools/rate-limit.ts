import { FILE_LIMITS } from "@/lib/config/limits";
import { generationLimitReached } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function assertAnonymousRateLimit(actor: Actor, action: string): void {
  if (actor.type !== "anonymous") {
    return;
  }

  const key = `${actor.sessionId}:${action}`;
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + FILE_LIMITS.ANONYMOUS_RATE_WINDOW_MS,
    });
    return;
  }

  if (current.count >= FILE_LIMITS.ANONYMOUS_RATE_LIMIT) {
    throw generationLimitReached("Please wait a few minutes before trying again.");
  }
  current.count += 1;
}
