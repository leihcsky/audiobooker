import { handleApiRoute, success } from "@/lib/api/response";
import { requireSession } from "@/lib/auth/session";
import { getPayPerBookOrderForUser } from "@/lib/billing/pay-per-book.service";
import { z } from "zod";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const { orderId } = z
      .object({ orderId: z.string().uuid("Invalid order ID.") })
      .parse(await context.params);
    const order = await getPayPerBookOrderForUser(orderId, user.id);
    return success({ order });
  });
}
