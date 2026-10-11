import { z } from "zod";
import { handleApiRoute, success } from "@/lib/api/response";
import { getOptionalActor } from "@/lib/auth/actor";
import { recordToolEvent } from "@/lib/tools/events";

const eventSchema = z.object({
  name: z.string().trim().min(1).max(80),
  path: z.string().trim().max(255).optional(),
  projectId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  return handleApiRoute(async () => {
    const actor = await getOptionalActor();
    const body: unknown = await request.json().catch(() => null);
    const input = eventSchema.parse(body);
    await recordToolEvent({
      actor,
      name: input.name,
      path: input.path,
      projectId: input.projectId,
    });
    return success({ recorded: true });
  });
}
