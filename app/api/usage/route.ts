import { handleApiRoute, success } from "@/lib/api/response";
import { requireSession } from "@/lib/auth/session";
import { getUsageSummary } from "@/lib/billing/usage-summary";

export async function GET() {
  return handleApiRoute(async () => {
    const user = await requireSession();
    return success(await getUsageSummary(user.id));
  });
}
