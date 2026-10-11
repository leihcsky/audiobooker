import { handleApiRoute, success } from "@/lib/api/response";
import { forbidden } from "@/lib/api/errors";
import { cleanupExpiredAnonymousProjects } from "@/lib/tools/cleanup";
import { pruneTtsCache } from "@/lib/tts/cache";

export async function POST(request: Request) {
  return handleApiRoute(async () => {
    const expected = process.env.CRON_SECRET?.trim();
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!expected || provided !== expected) {
      throw forbidden("Invalid cleanup credentials.");
    }
    const deleted = await cleanupExpiredAnonymousProjects();
    const prunedCacheEntries = await pruneTtsCache();
    return success({ deleted, prunedCacheEntries });
  });
}
