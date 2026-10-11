import { requireActor } from "@/lib/auth/actor";
import { requireSession } from "@/lib/auth/session";
import { handleApiRoute, success } from "@/lib/api/response";
import { deleteProjectForUser, updateProjectForUser } from "@/lib/projects/project.service";
import { getProjectDetailForActor } from "@/lib/projects/project.detail";
import { projectIdSchema, updateProjectSchema } from "@/lib/validation/project";

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
    const detail = await getProjectDetailForActor(projectId, actor);

    return success(detail);
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const projectId = await parseProjectId(context.params);
    const body: unknown = await request.json().catch(() => null);
    const input = updateProjectSchema.parse(body);
    const project = await updateProjectForUser(projectId, user.id, input);

    return success({ project });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const projectId = await parseProjectId(context.params);
    await deleteProjectForUser(projectId, user.id);

    return success({ deleted: true });
  });
}
