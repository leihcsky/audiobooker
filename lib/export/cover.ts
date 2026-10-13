import { coverNotFound } from "@/lib/api/errors";
import { FILE_LIMITS } from "@/lib/config/limits";
import { prisma } from "@/lib/db/prisma";
import { validateCoverImage } from "@/lib/export/image";
import type { Actor } from "@/lib/auth/actor";
import { getProjectForUser } from "@/lib/projects/project.service";
import { assertProjectAccess } from "@/lib/tools/access";
import { getStorage } from "@/lib/storage";
import { buildCoverObjectKey } from "@/lib/storage/keys";

export type CoverUploadResult = {
  coverUrl: string;
  expiresAt: string;
  contentType: string;
};

export async function uploadProjectCover(input: {
  projectId: string;
  userId: string;
  body: Buffer;
}): Promise<CoverUploadResult> {
  const project = await getProjectForUser(input.projectId, input.userId);
  const detected = validateCoverImage(input.body);
  const objectKey = buildCoverObjectKey({
    owner: { kind: "user", id: input.userId },
    projectId: project.id,
    extension: detected.kind,
  });
  const storage = getStorage();

  await storage.putObject({
    objectKey,
    body: input.body,
    contentType: detected.contentType,
  });

  if (project.hasCover) {
    const current = await prisma.project.findUnique({
      where: { id: project.id },
      select: { coverObjectKey: true },
    });
    if (current?.coverObjectKey && current.coverObjectKey !== objectKey) {
      await storage.deleteObject(current.coverObjectKey).catch(() => undefined);
    }
  }

  await prisma.project.update({
    where: { id: project.id },
    data: {
      coverObjectKey: objectKey,
      coverWidth: detected.dimensions.width,
      coverHeight: detected.dimensions.height,
    },
  });

  const signed = await storage.createDownloadUrl({
    objectKey,
    expiresInSeconds: FILE_LIMITS.COVER_SIGNED_URL_SECONDS,
  });

  return {
    coverUrl: signed.downloadUrl,
    expiresAt: signed.expiresAt.toISOString(),
    contentType: detected.contentType,
  };
}

export async function getProjectCoverForUser(
  projectId: string,
  userId: string,
): Promise<CoverUploadResult> {
  return getProjectCoverForActor(projectId, { type: "user", userId });
}

export async function getProjectCoverForActor(
  projectId: string,
  actor: Actor,
): Promise<CoverUploadResult> {
  const project = await assertProjectAccess(actor, projectId);
  const record = await prisma.project.findUnique({
    where: { id: project.id },
    select: { coverObjectKey: true },
  });
  if (!record?.coverObjectKey) {
    throw coverNotFound();
  }

  const signed = await getStorage().createDownloadUrl({
    objectKey: record.coverObjectKey,
    expiresInSeconds: FILE_LIMITS.COVER_SIGNED_URL_SECONDS,
  });

  return {
    coverUrl: signed.downloadUrl,
    expiresAt: signed.expiresAt.toISOString(),
    contentType: record.coverObjectKey.endsWith(".png")
      ? "image/png"
      : record.coverObjectKey.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg",
  };
}
