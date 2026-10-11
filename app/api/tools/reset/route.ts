import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { resetAnonymousToolWorkspace } from "@/lib/tools/reset";

export async function POST() {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const result = await resetAnonymousToolWorkspace(actor);
    return success(result);
  });
}
