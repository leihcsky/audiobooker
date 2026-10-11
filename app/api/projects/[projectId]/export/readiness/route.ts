import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { getExportReadinessForActor } from "@/lib/export/export.service";
import { projectIdSchema } from "@/lib/validation/project";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { projectId } = await context.params;
    const parsedId = projectIdSchema.parse(projectId);
    const readiness = await getExportReadinessForActor(parsedId, actor);
    return success({ readiness });
  });
}
