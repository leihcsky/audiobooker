import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { startMp3Export } from "@/lib/export/export.service";
import { scheduleExportJob } from "@/lib/jobs/schedule-export";
import { recordToolEvent } from "@/lib/tools/events";
import { assertAnonymousRateLimit } from "@/lib/tools/rate-limit";
import { exportMp3Schema } from "@/lib/validation/export";
import { projectIdSchema } from "@/lib/validation/project";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    assertAnonymousRateLimit(actor, "export");
    const { projectId } = await context.params;
    const parsedId = projectIdSchema.parse(projectId);
    const body: unknown = await request.json().catch(() => undefined);
    exportMp3Schema.parse(body);
    const started = await startMp3Export({
      projectId: parsedId,
      actor,
    });
    await recordToolEvent({ actor, projectId: parsedId, name: "tool_export_started" });
    if (started.job.status === "QUEUED") {
      scheduleExportJob(started.job.id);
    }
    return success(started, 202);
  });
}
