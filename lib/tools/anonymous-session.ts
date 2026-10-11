import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { FILE_LIMITS } from "@/lib/config/limits";
import { clientIpFromHeaders, hashClientNetwork } from "@/lib/tools/client-network";
import { prisma } from "@/lib/db/prisma";
import { sessionExpired } from "@/lib/api/errors";
import type { AnonymousActor } from "@/lib/auth/actor";

export const ANON_COOKIE = "ab_anon";

export type AnonymousSessionRecord = {
  id: string;
  expiresAt: Date;
};

export function hashAnonymousToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isAnonymousSessionExpired(session: { expiresAt: Date }): boolean {
  return session.expiresAt.getTime() <= Date.now();
}

function cookieMaxAgeSeconds(): number {
  return FILE_LIMITS.ANONYMOUS_PROJECT_TTL_DAYS * 24 * 60 * 60;
}

async function setAnonymousCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(ANON_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cookieMaxAgeSeconds(),
  });
}

export async function createAnonymousSession(): Promise<AnonymousActor> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + cookieMaxAgeSeconds() * 1000);
  const record = await prisma.anonymousSession.create({
    data: {
      tokenHash: hashAnonymousToken(token),
      ipHash: hashClientNetwork(clientIpFromHeaders(await headers())),
      expiresAt,
      lastSeenAt: new Date(),
    },
  });
  await setAnonymousCookie(token);
  return { type: "anonymous", sessionId: record.id };
}

export async function getAnonymousSessionFromToken(
  token: string,
): Promise<AnonymousSessionRecord | null> {
  const record = await prisma.anonymousSession.findUnique({
    where: { tokenHash: hashAnonymousToken(token) },
    select: { id: true, expiresAt: true },
  });
  if (!record) {
    return null;
  }
  if (isAnonymousSessionExpired(record)) {
    return record;
  }
  await prisma.anonymousSession.update({
    where: { id: record.id },
    data: { lastSeenAt: new Date() },
  });
  return record;
}

export async function peekAnonymousSessionId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(ANON_COOKIE)?.value;
  if (!token) {
    return null;
  }
  const existing = await getAnonymousSessionFromToken(token);
  if (!existing || isAnonymousSessionExpired(existing)) {
    return null;
  }
  return existing.id;
}

export async function ensureAnonymousSession(): Promise<AnonymousActor> {
  const existingId = await peekAnonymousSessionId();
  if (existingId) {
    return { type: "anonymous", sessionId: existingId };
  }
  return createAnonymousSession();
}

export async function requireAnonymousSessionRecord(sessionId: string) {
  const record = await prisma.anonymousSession.findUnique({
    where: { id: sessionId },
  });
  if (!record || isAnonymousSessionExpired(record)) {
    throw sessionExpired();
  }
  return record;
}
