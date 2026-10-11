import type { Prisma } from "@/generated/prisma";
import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/prisma";

const ALLOWED_EVENTS = new Set([
  "seo_tool_view",
  "tool_file_selected",
  "tool_upload_started",
  "tool_upload_completed",
  "tool_parse_started",
  "tool_parse_completed",
  "tool_voice_selected",
  "tool_generate_started",
  "tool_generate_completed",
  "tool_generate_failed",
  "tool_export_started",
  "tool_export_completed",
  "tool_download",
  "tool_signup_clicked",
  "tool_project_claimed",
]);

export async function recordToolEvent(input: {
  actor?: Actor | null;
  projectId?: string | null;
  name: string;
  path?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!ALLOWED_EVENTS.has(input.name)) {
    return;
  }
  await prisma.toolEvent.create({
    data: {
      name: input.name,
      path: input.path ?? null,
      projectId: input.projectId ?? null,
      userId: input.actor?.type === "user" ? input.actor.userId : null,
      anonymousSessionId: input.actor?.type === "anonymous" ? input.actor.sessionId : null,
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });
}
