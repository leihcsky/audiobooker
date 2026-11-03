import { handleApiRoute, success } from "@/lib/api/response";
import { requireSession } from "@/lib/auth/session";
import { createPayPerBookQuote } from "@/lib/billing/pay-per-book.service";
import { payPerBookQuoteSchema } from "@/lib/validation/pay-per-book";

export async function POST(request: Request) {
  return handleApiRoute(async () => {
    const user = await requireSession();
    const input = payPerBookQuoteSchema.parse(await request.json().catch(() => ({})));
    const quote = await createPayPerBookQuote({
      userId: user.id,
      projectId: input.projectId,
      chapterIds: input.chapterIds,
      voiceId: input.voiceId,
      speed: input.speed,
    });
    return success({ quote });
  });
}
