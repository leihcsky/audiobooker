import { requireSession } from "@/lib/auth/session";
import { handleApiRoute, success } from "@/lib/api/response";
import {
  createPronunciationForUser,
  listPronunciationsForUser,
} from "@/lib/pronunciation/pronunciation.service";
import { createPronunciationSchema } from "@/lib/validation/pronunciation";
import { projectIdSchema } from "@/lib/validation/project";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const projectId = projectIdSchema.parse((await context.params).projectId);
    return success(await listPronunciationsForUser(projectId, user.id));
  });
}

export async function POST(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const projectId = projectIdSchema.parse((await context.params).projectId);
    const body: unknown = await request.json().catch(() => null);
    const input = createPronunciationSchema.parse(body);
    return success(await createPronunciationForUser(projectId, user.id, input), 201);
  });
}
