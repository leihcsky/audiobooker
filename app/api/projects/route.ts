import { requireActor } from "@/lib/auth/actor";
import { requireSession } from "@/lib/auth/session";
import { handleApiRoute, success } from "@/lib/api/response";
import { listProjectsForUser } from "@/lib/projects/project.service";
import { createProjectForActor } from "@/lib/tools/project";
import {
  createProjectSchema,
  listProjectsQuerySchema,
} from "@/lib/validation/project";

export async function POST(request: Request) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const body: unknown = await request.json().catch(() => null);
    const input = createProjectSchema.parse(body);
    const project = await createProjectForActor(actor, input);

    return success({ project }, 201);
  });
}

export async function GET(request: Request) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const url = new URL(request.url);
    const query = listProjectsQuerySchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });

    const result = await listProjectsForUser(user.id, query);
    return success(result);
  });
}
