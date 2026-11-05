import { handleApiRoute, success } from "@/lib/api/response";
import { requireSession } from "@/lib/auth/session";
import { cancelSubscriptionRenewal } from "@/lib/billing/subscription.service";

export async function POST() {
  return handleApiRoute(async () => {
    const user = await requireSession();
    return success(await cancelSubscriptionRenewal(user.id));
  });
}
