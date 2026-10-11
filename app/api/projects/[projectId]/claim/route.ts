import { requireSession } from "@/lib/auth/session";
import { handleApiRoute, success } from "@/lib/api/response";
import { peekAnonymousSessionId } from "@/lib/tools/anonymous-session";
import { claimProjectForUser } from "@/lib/tools/project";
import { recordToolEvent } from "@/lib/tools/events";
import { projectIdSchema } from "@/lib/validation/project";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const { projectId } = await context.params;
    const parsedId = projectIdSchema.parse(projectId);
    const sessionId = await peekAnonymousSessionId();
    const project = await claimProjectForUser(parsedId, user.id, sessionId);
    await recordToolEvent({
      actor: { type: "user", userId: user.id },
      projectId: parsedId,
      name: "tool_project_claimed",
    });
    return success({ project });
  });
}
