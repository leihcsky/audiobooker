import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { startChapterGeneration } from "@/lib/chapters/generation.service";
import { scheduleTtsJob } from "@/lib/jobs/schedule-tts";
import { recordToolEvent } from "@/lib/tools/events";
import { assertAnonymousRateLimit } from "@/lib/tools/rate-limit";
import { generateChapterSchema } from "@/lib/validation/tts";
import { chapterIdSchema } from "@/lib/validation/upload";

type RouteContext = {
  params: Promise<{ chapterId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    assertAnonymousRateLimit(actor, "generate");
    const { chapterId } = await context.params;
    const parsedChapterId = chapterIdSchema.parse(chapterId);
    const body: unknown = await request.json().catch(() => null);
    const input = generateChapterSchema.parse(body);
    const job = await startChapterGeneration({
      actor,
      chapterId: parsedChapterId,
      voiceId: input.voiceId,
      speed: input.speed,
      quality: input.quality,
    });
    await recordToolEvent({ actor, name: "tool_generate_started" });
    console.info("tts_job_enqueued", { jobId: job.id, status: job.status });
    if (job.status === "QUEUED" || job.status === "PROCESSING") {
      scheduleTtsJob(job.id);
    }
    return success({ job }, 202);
  });
}
