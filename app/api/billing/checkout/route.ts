import { handleApiRoute, success } from "@/lib/api/response";
import { requireSession } from "@/lib/auth/session";
import { createCheckout } from "@/lib/billing/checkout.service";
import { checkoutSchema } from "@/lib/validation/billing";

export async function POST(request: Request) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const { item } = checkoutSchema.parse(await request.json().catch(() => ({})));
    return success(await createCheckout(user, item));
  });
}
