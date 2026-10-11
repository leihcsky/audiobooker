import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { deleteChapterForActor, updateChapterForActor } from "@/lib/chapters/chapter-edit.service";
import { getChapterForActor } from "@/lib/chapters/chapter.service";
import { updateChapterSchema } from "@/lib/validation/chapter";
import { chapterIdSchema } from "@/lib/validation/upload";

type RouteContext = {
  params: Promise<{ chapterId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { chapterId } = await context.params;
    const parsedId = chapterIdSchema.parse(chapterId);
    const chapter = await getChapterForActor(parsedId, actor);
    return success({ chapter });
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { chapterId } = await context.params;
    const parsedId = chapterIdSchema.parse(chapterId);
    const body: unknown = await request.json().catch(() => null);
    const input = updateChapterSchema.parse(body);
    const chapter = await updateChapterForActor(parsedId, actor, input);
    return success({ chapter });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { chapterId } = await context.params;
    const parsedId = chapterIdSchema.parse(chapterId);
    const chapters = await deleteChapterForActor(parsedId, actor);
    return success({ chapters });
  });
}
