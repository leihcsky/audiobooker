import { requireSession } from "@/lib/auth/session";
import { handleApiRoute, success } from "@/lib/api/response";
import { regenerateParagraphForUser } from "@/lib/chapters/paragraph.service";
import { scheduleTtsJob } from "@/lib/jobs/schedule-tts";
import { paragraphIndexSchema, regenerateParagraphSchema } from "@/lib/validation/paragraph";
import { chapterIdSchema } from "@/lib/validation/upload";

type RouteContext = {
  params: Promise<{ chapterId: string; index: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const { chapterId, index } = await context.params;
    const body: unknown = await request.json().catch(() => null);
    const job = await regenerateParagraphForUser({
      chapterId: chapterIdSchema.parse(chapterId),
      userId: user.id,
      index: paragraphIndexSchema.parse(index),
      body: regenerateParagraphSchema.parse(body),
    });
    if (job.status === "QUEUED" || job.status === "PROCESSING") {
      scheduleTtsJob(job.id);
    }
    return success({ job }, 202);
  });
}
