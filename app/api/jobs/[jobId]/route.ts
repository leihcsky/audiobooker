import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { getJobForActor } from "@/lib/jobs/job.service";
import { jobIdSchema } from "@/lib/validation/upload";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { jobId } = await context.params;
    const parsedId = jobIdSchema.parse(jobId);
    const job = await getJobForActor(parsedId, actor);
    return success({ job });
  });
}
