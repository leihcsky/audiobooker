import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { reorderChaptersForActor } from "@/lib/chapters/chapter-edit.service";
import { reorderChaptersSchema } from "@/lib/validation/chapter";
import { projectIdSchema } from "@/lib/validation/project";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { projectId } = await context.params;
    projectIdSchema.parse(projectId);
    const body: unknown = await request.json().catch(() => null);
    const input = reorderChaptersSchema.parse(body);
    const chapters = await reorderChaptersForActor(projectId, actor, input.chapterIds);
    return success({ chapters });
  });
}
