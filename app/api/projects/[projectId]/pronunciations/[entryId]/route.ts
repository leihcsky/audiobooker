import { requireSession } from "@/lib/auth/session";
import { handleApiRoute, success } from "@/lib/api/response";
import {
  deletePronunciationForUser,
  updatePronunciationForUser,
} from "@/lib/pronunciation/pronunciation.service";
import { pronunciationIdSchema, updatePronunciationSchema } from "@/lib/validation/pronunciation";
import { projectIdSchema } from "@/lib/validation/project";

type RouteContext = {
  params: Promise<{ projectId: string; entryId: string }>;
};

async function parseParams(params: RouteContext["params"]) {
  const { projectId, entryId } = await params;
  return {
    projectId: projectIdSchema.parse(projectId),
    entryId: pronunciationIdSchema.parse(entryId),
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const { projectId, entryId } = await parseParams(context.params);
    const body: unknown = await request.json().catch(() => null);
    const input = updatePronunciationSchema.parse(body);
    return success(await updatePronunciationForUser(projectId, entryId, user.id, input));
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const { projectId, entryId } = await parseParams(context.params);
    return success(await deletePronunciationForUser(projectId, entryId, user.id));
  });
}
