import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { getExportForActor } from "@/lib/export/export.service";
import { exportIdSchema } from "@/lib/validation/export";

type RouteContext = {
  params: Promise<{ exportId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { exportId } = await context.params;
    const parsedId = exportIdSchema.parse(exportId);
    const record = await getExportForActor(parsedId, actor);
    return success({ export: record });
  });
}
