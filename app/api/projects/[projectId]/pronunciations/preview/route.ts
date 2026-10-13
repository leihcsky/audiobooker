import { requireSession } from "@/lib/auth/session";
import { handleApiRoute, success } from "@/lib/api/response";
import { previewPronunciationForUser } from "@/lib/pronunciation/pronunciation.service";
import { previewPronunciationSchema } from "@/lib/validation/pronunciation";
import { projectIdSchema } from "@/lib/validation/project";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const projectId = projectIdSchema.parse((await context.params).projectId);
    const body: unknown = await request.json().catch(() => null);
    const input = previewPronunciationSchema.parse(body);
    return success(await previewPronunciationForUser(projectId, user.id, input));
  });
}
