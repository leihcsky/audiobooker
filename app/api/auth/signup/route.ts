import { signupSchema } from "@/lib/validation/auth";
import { signupUser } from "@/lib/auth/signup";
import { handleApiRoute, success } from "@/lib/api/response";
import { getOptionalActor } from "@/lib/auth/actor";
import { claimSessionProjectsForUser } from "@/lib/tools/project";
import { recordToolEvent } from "@/lib/tools/events";

export async function POST(request: Request) {
  return handleApiRoute(async () => {
    const body: unknown = await request.json().catch(() => null);
    const input = signupSchema.parse(body);
    const actor = await getOptionalActor();
    const user = await signupUser(input);
    let claimed: { id: string }[] = [];
    if (actor?.type === "anonymous") {
      claimed = await claimSessionProjectsForUser(actor.sessionId, user.id);
      if (claimed[0]) {
        await recordToolEvent({
          actor: { type: "user", userId: user.id },
          projectId: claimed[0].id,
          name: "tool_project_claimed",
        });
      }
    }

    return success({ user, claimedProjectId: claimed[0]?.id ?? null }, 201);
  });
}
