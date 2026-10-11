import { requireActor } from "@/lib/auth/actor";
import { handleApiRoute, success } from "@/lib/api/response";
import { previewVoiceSchema, voiceIdSchema } from "@/lib/validation/tts";
import { previewVoiceForActor } from "@/lib/voices/voice.service";
import { recordToolEvent } from "@/lib/tools/events";

type RouteContext = {
  params: Promise<{ voiceId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApiRoute(async () => {
    const actor = await requireActor();
    const { voiceId } = await context.params;
    const parsedVoiceId = voiceIdSchema.parse(voiceId);
    const body: unknown = await request.json().catch(() => ({}));
    const input = previewVoiceSchema.parse(body);
    const preview = await previewVoiceForActor({
      actor,
      voiceId: parsedVoiceId,
      text: input.text,
      speed: input.speed,
    });
    await recordToolEvent({ actor, name: "tool_voice_selected", metadata: { voiceId: parsedVoiceId } });
    return success(preview);
  });
}
