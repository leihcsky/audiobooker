import type { Prisma } from "@/generated/prisma";
import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/prisma";

/** All events persisted in ToolEvent for funnel / conversion analysis. */
export const TOOL_EVENT_NAMES = [
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
  "sign_up_completed",
  "quote_created",
  "checkout_started",
  "checkout_returned",
  "checkout_failed",
  "checkout_paid",
] as const;

export type ToolEventName = (typeof TOOL_EVENT_NAMES)[number];

const ALLOWED_EVENTS = new Set<string>(TOOL_EVENT_NAMES);

/**
 * Browser/API-posted events only. Job completions and payment outcomes are
 * written from server workers so clients cannot inflate conversion.
 */
export const CLIENT_TOOL_EVENTS = new Set<string>([
  "seo_tool_view",
  "tool_file_selected",
  "tool_signup_clicked",
  "checkout_returned",
]);

export type RecordToolEventInput = {
  actor?: Actor | null;
  userId?: string | null;
  anonymousSessionId?: string | null;
  projectId?: string | null;
  name: string;
  path?: string | null;
  metadata?: Record<string, unknown>;
};

function resolveIds(input: RecordToolEventInput): {
  userId: string | null;
  anonymousSessionId: string | null;
} {
  if (input.actor?.type === "user") {
    return { userId: input.actor.userId, anonymousSessionId: input.anonymousSessionId ?? null };
  }
  if (input.actor?.type === "anonymous") {
    return { userId: input.userId ?? null, anonymousSessionId: input.actor.sessionId };
  }
  return {
    userId: input.userId ?? null,
    anonymousSessionId: input.anonymousSessionId ?? null,
  };
}

/** Persist a funnel event. Never throws — analytics must not break product flows. */
export async function recordToolEvent(input: RecordToolEventInput): Promise<void> {
  if (!ALLOWED_EVENTS.has(input.name)) {
    return;
  }
  const { userId, anonymousSessionId } = resolveIds(input);
  try {
    await prisma.toolEvent.create({
      data: {
        name: input.name,
        path: input.path ?? null,
        projectId: input.projectId ?? null,
        userId,
        anonymousSessionId,
        metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  } catch (error) {
    console.error("tool_event_record_failed", {
      name: input.name,
      projectId: input.projectId ?? null,
      message: error instanceof Error ? error.message.slice(0, 300) : "unknown",
    });
  }
}

/** Resolve project owners and record an event (used by background job runners). */
export async function recordToolEventForProject(input: {
  projectId: string;
  name: ToolEventName;
  path?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { userId: true, anonymousSessionId: true },
    });
    if (!project) {
      return;
    }
    await recordToolEvent({
      projectId: input.projectId,
      userId: project.userId,
      anonymousSessionId: project.anonymousSessionId,
      name: input.name,
      path: input.path,
      metadata: input.metadata,
    });
  } catch (error) {
    console.error("tool_event_for_project_failed", {
      name: input.name,
      projectId: input.projectId,
      message: error instanceof Error ? error.message.slice(0, 300) : "unknown",
    });
  }
}
