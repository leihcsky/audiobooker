import { requireActor } from "@/lib/auth/actor";
import { requireSession } from "@/lib/auth/session";
import { fileInvalid } from "@/lib/api/errors";
import { handleApiRoute, success } from "@/lib/api/response";
import { getProjectCoverForActor, uploadProjectCover } from "@/lib/export/cover";
import { projectIdSchema } from "@/lib/validation/project";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

async function parseProjectId(params: Promise<{ projectId: string }>): Promise<string> {
  const { projectId } = await params;
  return projectIdSchema.parse(projectId);
}

export async function GET(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const projectId = await parseProjectId(context.params);
    const cover = await getProjectCoverForActor(projectId, actor);
    return success({ cover });
  });
}

export async function POST(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const projectId = await parseProjectId(context.params);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw fileInvalid("A cover image is required.");
    }
    const body = Buffer.from(await file.arrayBuffer());
    const cover = await uploadProjectCover({
      projectId,
      userId: user.id,
      body,
    });
    return success({ cover });
  });
}
