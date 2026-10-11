import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { getChapterAudioForActor } from "@/lib/chapters/audio.service";
import { chapterIdSchema } from "@/lib/validation/upload";

type RouteContext = {
  params: Promise<{ chapterId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { chapterId } = await context.params;
    const parsedId = chapterIdSchema.parse(chapterId);
    const playback = await getChapterAudioForActor(parsedId, actor);
    return success(playback);
  });
}
