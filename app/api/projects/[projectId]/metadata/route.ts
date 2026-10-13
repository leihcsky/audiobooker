import { requireSession } from "@/lib/auth/session";
import { handleApiRoute, success } from "@/lib/api/response";
import type { ProjectDto } from "@/lib/projects/project.dto";
import { getProjectForUser, updateProjectForUser } from "@/lib/projects/project.service";
import { projectIdSchema, updateMetadataSchema } from "@/lib/validation/project";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

async function parseProjectId(params: Promise<{ projectId: string }>): Promise<string> {
  const { projectId } = await params;
  return projectIdSchema.parse(projectId);
}

function toMetadata(project: ProjectDto) {
  return {
    title: project.title,
    author: project.author,
    narrator: project.narrator,
    language: project.language,
    description: project.description,
    publisher: project.publisher,
    copyright: project.copyright,
    aiDisclosure: project.aiDisclosure,
    effectiveAiDisclosure: project.effectiveAiDisclosure,
    hasCover: project.hasCover,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const projectId = await parseProjectId(context.params);
    const project = await getProjectForUser(projectId, user.id);
    return success({ metadata: toMetadata(project) });
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const projectId = await parseProjectId(context.params);
    const body: unknown = await request.json().catch(() => null);
    const input = updateMetadataSchema.parse(body);
    const project = await updateProjectForUser(projectId, user.id, input);
    return success({ metadata: toMetadata(project) });
  });
}
