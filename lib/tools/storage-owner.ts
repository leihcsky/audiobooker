import type { Actor } from "@/lib/auth/actor";

export type StorageOwner = {
  kind: "user" | "anonymous";
  id: string;
};

export function storageOwnerFromActor(actor: Actor): StorageOwner {
  return actor.type === "user"
    ? { kind: "user", id: actor.userId }
    : { kind: "anonymous", id: actor.sessionId };
}

export function storageOwnerFromProject(project: {
  userId: string | null;
  anonymousSessionId: string | null;
}): StorageOwner {
  if (project.userId) {
    return { kind: "user", id: project.userId };
  }
  if (project.anonymousSessionId) {
    return { kind: "anonymous", id: project.anonymousSessionId };
  }
  throw new Error("Project has no storage owner.");
}

export function ownerPrefix(owner: StorageOwner): string {
  return owner.kind === "user" ? `users/${owner.id}` : `anonymous/${owner.id}`;
}
