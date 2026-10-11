import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { confirmSourceUpload } from "@/lib/ingestion/source.service";
import { recordToolEvent } from "@/lib/tools/events";
import { confirmSourceFileSchema } from "@/lib/validation/upload";
import { projectIdSchema } from "@/lib/validation/project";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { projectId } = await context.params;
    projectIdSchema.parse(projectId);
    const body: unknown = await request.json().catch(() => null);
    const input = confirmSourceFileSchema.parse(body);
    const sourceFile = await confirmSourceUpload({
      actor,
      projectId,
      objectKey: input.objectKey,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });

    await recordToolEvent({ actor, projectId, name: "tool_upload_completed" });
    return success({ sourceFile }, 201);
  });
}
