import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { sessionExpired } from "@/lib/api/errors";
import {
  ANON_COOKIE,
  createAnonymousSession,
  getAnonymousSessionFromToken,
  isAnonymousSessionExpired,
} from "@/lib/tools/anonymous-session";

export type UserActor = {
  type: "user";
  userId: string;
};

export type AnonymousActor = {
  type: "anonymous";
  sessionId: string;
};

export type Actor = UserActor | AnonymousActor;

export function actorUserId(actor: Actor): string | null {
  return actor.type === "user" ? actor.userId : null;
}

export function actorSessionId(actor: Actor): string | null {
  return actor.type === "anonymous" ? actor.sessionId : null;
}

export async function getOptionalActor(): Promise<Actor | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (userId) {
    return { type: "user", userId };
  }

  const jar = await cookies();
  const token = jar.get(ANON_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const anonymous = await getAnonymousSessionFromToken(token);
  if (!anonymous || isAnonymousSessionExpired(anonymous)) {
    return null;
  }

  return { type: "anonymous", sessionId: anonymous.id };
}

export async function requireActor(): Promise<Actor> {
  const existing = await getOptionalActor();
  if (existing) {
    return existing;
  }

  const session = await auth();
  if (session?.user?.id) {
    return { type: "user", userId: session.user.id };
  }

  return createAnonymousSession();
}

export async function requireExistingActor(): Promise<Actor> {
  const existing = await getOptionalActor();
  if (!existing) {
    throw sessionExpired();
  }
  return existing;
}
