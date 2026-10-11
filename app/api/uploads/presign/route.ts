import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { createSourceUploadAuthorization } from "@/lib/ingestion/source.service";
import { assertAnonymousRateLimit } from "@/lib/tools/rate-limit";
import { recordToolEvent } from "@/lib/tools/events";
import { presignUploadSchema } from "@/lib/validation/upload";

export async function POST(request: Request) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    assertAnonymousRateLimit(actor, "upload");
    const body: unknown = await request.json().catch(() => null);
    const input = presignUploadSchema.parse(body);
    const data = await createSourceUploadAuthorization({
      actor,
      projectId: input.projectId,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });

    await recordToolEvent({ actor, projectId: input.projectId, name: "tool_upload_started" });
    return success(data);
  });
}
