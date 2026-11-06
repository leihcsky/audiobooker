import { requireActor } from "@/lib/auth/actor";
import { handleRouteError } from "@/lib/api/response";
import { getChapterAudioFileForActor } from "@/lib/chapters/audio.service";
import { chapterIdSchema } from "@/lib/validation/upload";

type RouteContext = {
  params: Promise<{ chapterId: string }>;
};

/** Streams chapter MP3 from the same origin so the browser can seek for paragraph playback. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { chapterId } = await context.params;
    const parsedId = chapterIdSchema.parse(chapterId);
    const file = await getChapterAudioFileForActor(parsedId, actor);
    const bytes = new Uint8Array(file.body);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        "X-Audio-File-Id": file.audioFileId,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
