import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import {
  cancelProjectGenerationForActor,
  getProjectGenerationForActor,
  startProjectGeneration,
} from "@/lib/chapters/project-generation.service";
import { scheduleProjectGeneration } from "@/lib/jobs/schedule-tts";
import { recordToolEvent } from "@/lib/tools/events";
import { assertAnonymousRateLimit } from "@/lib/tools/rate-limit";
import { projectIdSchema } from "@/lib/validation/project";
import { generateProjectSchema } from "@/lib/validation/tts";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    assertAnonymousRateLimit(actor, "generate");
    const { projectId } = await context.params;
    projectIdSchema.parse(projectId);
    const body: unknown = await request.json().catch(() => null);
    const input = generateProjectSchema.parse(body);
    const { generation, created } = await startProjectGeneration({
      actor,
      projectId,
      voiceId: input.voiceId,
      speed: input.speed,
      quality: input.quality,
      chapterIds: input.chapterIds,
    });
    if (created) {
      await recordToolEvent({ actor, name: "tool_generate_started" });
      console.info("project_generation_enqueued", {
        jobId: generation.job.id,
        chapters: generation.totalChapters,
      });
    }
    scheduleProjectGeneration(generation.job.id);
    return success({ generation }, 202);
  });
}

export async function GET(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { projectId } = await context.params;
    projectIdSchema.parse(projectId);
    const { generation, resumeJobId } = await getProjectGenerationForActor(actor, projectId);
    if (resumeJobId) {
      scheduleProjectGeneration(resumeJobId);
    }
    return success({ generation });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { projectId } = await context.params;
    projectIdSchema.parse(projectId);
    const generation = await cancelProjectGenerationForActor(actor, projectId);
    return success({ generation });
  });
}
