import { handleApiRoute, success } from "@/lib/api/response";
import { auth } from "@/lib/auth/auth";
import { FILE_LIMITS } from "@/lib/config/limits";
import { ensureAnonymousSession } from "@/lib/tools/anonymous-session";
import { getCurrentAnonymousProjectId } from "@/lib/tools/project";
import { getStandardTtsAllowance } from "@/lib/usage/usage.service";

export async function POST() {
  return handleApiRoute(async () => {
    const session = await auth();
    if (session?.user?.id) {
      const actor = { type: "user" as const, userId: session.user.id };
      const allowance = await getStandardTtsAllowance(actor);
      return success({
        actor,
        projectId: null,
        limits: {
          maxFileBytes: FILE_LIMITS.MAX_EPUB_SIZE,
          maxCharacters: allowance.maxCharacters,
          remainingCharacters: allowance.remainingCharacters,
        },
      });
    }

    const actor = await ensureAnonymousSession();
    const [allowance, projectId] = await Promise.all([
      getStandardTtsAllowance(actor),
      getCurrentAnonymousProjectId(actor.sessionId),
    ]);
    return success({
      actor,
      projectId,
      limits: {
        maxFileBytes: FILE_LIMITS.MAX_ANONYMOUS_FILE_SIZE,
        maxCharacters: allowance.maxCharacters,
        remainingCharacters: allowance.remainingCharacters,
      },
    });
  });
}
