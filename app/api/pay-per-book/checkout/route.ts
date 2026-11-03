import { handleApiRoute, success } from "@/lib/api/response";
import { requireSession } from "@/lib/auth/session";
import { createPayPerBookCheckout } from "@/lib/billing/pay-per-book.service";
import { payPerBookCheckoutSchema } from "@/lib/validation/pay-per-book";

export async function POST(request: Request) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const { quoteId } = payPerBookCheckoutSchema.parse(await request.json().catch(() => ({})));
    return success(
      await createPayPerBookCheckout({
        userId: user.id,
        email: user.email,
        quoteId,
      }),
    );
  });
}
