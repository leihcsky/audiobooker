import { requireSession } from "@/lib/auth/session";
import { handleApiRoute, success } from "@/lib/api/response";
import { getProjectForUser, updateProjectForUser } from "@/lib/projects/project.service";
import { projectIdSchema, updateMetadataSchema } from "@/lib/validation/project";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

async function parseProjectId(params: Promise<{ projectId: string }>): Promise<string> {
  const { projectId } = await params;
  return projectIdSchema.parse(projectId);
}

export async function GET(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const projectId = await parseProjectId(context.params);
    const project = await getProjectForUser(projectId, user.id);
    return success({
      metadata: {
        title: project.title,
        author: project.author,
        narrator: project.narrator,
        language: project.language,
        description: project.description,
        publisher: project.publisher,
        copyright: project.copyright,
        hasCover: project.hasCover,
      },
    });
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const projectId = await parseProjectId(context.params);
    const body: unknown = await request.json().catch(() => null);
    const input = updateMetadataSchema.parse(body);
    const project = await updateProjectForUser(projectId, user.id, input);
    return success({
      metadata: {
        title: project.title,
        author: project.author,
        narrator: project.narrator,
        language: project.language,
        description: project.description,
        publisher: project.publisher,
        copyright: project.copyright,
        hasCover: project.hasCover,
      },
    });
  });
}
