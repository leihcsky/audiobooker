import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { recordToolEvent } from "@/lib/tools/events";
import { claimProjectForUser, claimSessionProjectsForUser } from "@/lib/tools/project";
import { projectIdSchema } from "@/lib/validation/project";

/** Same-site path or the fallback, so a redirect target cannot leave the site. */
export function safeRedirectPath(raw: string | null, fallback = "/studio"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  return raw;
}

const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

/** True when this OAuth sign-in just created the account (no password, created moments ago). */
export async function isNewOAuthAccount(userId: string, now = new Date()): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, passwordHash: true },
  });
  return Boolean(
    user && user.passwordHash === null && now.getTime() - user.createdAt.getTime() < NEW_ACCOUNT_WINDOW_MS,
  );
}

/**
 * Saves free-tool work after an OAuth sign-in: the requested project, or the
 * anonymous session's projects. Returns the claimed project id; a claim the
 * user cannot make (expired, plan limit) is skipped.
 */
export async function claimAfterSignIn(input: {
  userId: string;
  sessionId: string | null;
  claimId: string | null;
}): Promise<string | null> {
  let projectId: string | null = null;
  try {
    if (input.claimId) {
      const parsed = projectIdSchema.safeParse(input.claimId);
      if (!parsed.success) {
        return null;
      }
      projectId = (await claimProjectForUser(parsed.data, input.userId, input.sessionId)).id;
    } else if (input.sessionId) {
      projectId = (await claimSessionProjectsForUser(input.sessionId, input.userId))[0]?.id ?? null;
    }
  } catch (error) {
    if (error instanceof AppError) {
      return null;
    }
    throw error;
  }
  if (projectId) {
    await recordToolEvent({
      actor: { type: "user", userId: input.userId },
      projectId,
      name: "tool_project_claimed",
    });
  }
  return projectId;
}
