import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { parseSourceSchema } from "@/lib/validation/upload";
import { projectIdSchema } from "@/lib/validation/project";
import { startParseJob } from "@/lib/jobs/parse.runner";
import { scheduleParseJob } from "@/lib/jobs/schedule-parse";
import { assertAnonymousRateLimit } from "@/lib/tools/rate-limit";
import { recordToolEvent } from "@/lib/tools/events";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    assertAnonymousRateLimit(actor, "parse");
    const { projectId } = await context.params;
    projectIdSchema.parse(projectId);
    const body: unknown = await request.json().catch(() => null);
    const input = parseSourceSchema.parse(body);
    const job = await startParseJob({
      actor,
      projectId,
      sourceFileId: input.sourceFileId,
    });

    await recordToolEvent({ actor, projectId, name: "tool_parse_started" });
    scheduleParseJob(job.id);

    return success({ job }, 202);
  });
}
