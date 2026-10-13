import { handleApiRoute, success } from "@/lib/api/response";
import { handleBillingWebhook } from "@/lib/billing/webhook.service";

export async function POST(request: Request) {
  return handleApiRoute(async () => {
    const rawBody = await request.text();
    const result = await handleBillingWebhook(rawBody, request.headers.get("x-waffo-signature"));
    return success({ received: true, duplicate: result.duplicate });
  });
}
