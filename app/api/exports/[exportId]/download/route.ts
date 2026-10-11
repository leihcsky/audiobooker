import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { createExportDownload } from "@/lib/export/export.service";
import { recordToolEvent } from "@/lib/tools/events";
import { exportIdSchema } from "@/lib/validation/export";

type RouteContext = {
  params: Promise<{ exportId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { exportId } = await context.params;
    const parsedId = exportIdSchema.parse(exportId);
    const download = await createExportDownload({
      exportId: parsedId,
      actor,
    });
    await recordToolEvent({ actor, name: "tool_download" });
    return success({ download });
  });
}
