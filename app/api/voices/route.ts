import { getOptionalActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { voicesQuerySchema } from "@/lib/validation/tts";
import { listVoiceDtos } from "@/lib/voices/voice.service";

export async function GET(request: Request) {
  return handleApiRoute(async () => {
    const url = new URL(request.url);
    const query = voicesQuerySchema.parse({
      language: url.searchParams.get("language") ?? undefined,
      provider: url.searchParams.get("provider") ?? undefined,
      tier: url.searchParams.get("tier") ?? undefined,
    });
    const actor = (await getOptionalActor()) ?? { type: "anonymous" as const, sessionId: "" };
    return success({ voices: await listVoiceDtos(actor, query) });
  });
}
