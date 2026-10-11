import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { listChaptersForActor, setIncludedChaptersForActor } from "@/lib/chapters/chapter.service";
import { projectIdSchema } from "@/lib/validation/project";
import { selectChaptersSchema } from "@/lib/validation/upload";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { projectId } = await context.params;
    projectIdSchema.parse(projectId);
    const chapters = await listChaptersForActor(projectId, actor);
    return success({ chapters });
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { projectId } = await context.params;
    projectIdSchema.parse(projectId);
    const body: unknown = await request.json().catch(() => null);
    const input = selectChaptersSchema.parse(body);
    const chapters = await setIncludedChaptersForActor(projectId, actor, input.includedIds);
    return success({ chapters });
  });
}
