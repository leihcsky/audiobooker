import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { FILE_LIMITS } from "@/lib/config/limits";
import { fileInvalid, fileNotFound, fileTooLarge, uploadFailed } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { assertProjectAccess } from "@/lib/tools/access";
import { storageOwnerFromActor } from "@/lib/tools/storage-owner";
import { getStorage } from "@/lib/storage";
import { buildSourceObjectKey, parseSourceObjectKey } from "@/lib/storage/keys";
import {
  extensionForType,
  validateUploadRequest,
} from "@/lib/ingestion/file-type";
import { toSourceFileSummary, type SourceFileSummary } from "@/lib/projects/project.detail";

function assertAnonymousFileSize(actor: Actor, sizeBytes: number) {
  if (actor.type === "anonymous" && sizeBytes > FILE_LIMITS.MAX_ANONYMOUS_FILE_SIZE) {
    throw fileTooLarge();
  }
}

const CONFIRM_HEAD_ATTEMPTS = 5;
const CONFIRM_HEAD_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Waits briefly for a just-uploaded object to become visible to HeadObject. */
async function waitForUploadedObject(objectKey: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= CONFIRM_HEAD_ATTEMPTS; attempt += 1) {
    try {
      const head = await getStorage().headObject(objectKey);
      if (head.exists) {
        return head;
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt < CONFIRM_HEAD_ATTEMPTS) {
      await sleep(CONFIRM_HEAD_DELAY_MS * attempt);
    }
  }
  if (lastError) {
    throw uploadFailed();
  }
  return null;
}

export async function createSourceUploadAuthorization(input: {
  actor: Actor;
  projectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}) {
  await assertProjectAccess(input.actor, input.projectId);
  assertAnonymousFileSize(input.actor, input.sizeBytes);
  const { type, mimeType } = validateUploadRequest(input);
  const sourceFileId = randomUUID();
  const objectKey = buildSourceObjectKey({
    owner: storageOwnerFromActor(input.actor),
    projectId: input.projectId,
    sourceFileId,
    extension: extensionForType(type),
  });

  console.info("source_upload_started", {
    projectId: input.projectId,
    sourceFileId,
    sizeBytes: input.sizeBytes,
  });

  const signed = await getStorage().createUploadUrl({
    objectKey,
    contentType: mimeType,
    expiresInSeconds: FILE_LIMITS.PRESIGN_EXPIRES_SECONDS,
  });

  return {
    uploadUrl: signed.uploadUrl,
    objectKey: signed.objectKey,
    expiresAt: signed.expiresAt.toISOString(),
  };
}

export async function confirmSourceUpload(input: {
  actor: Actor;
  projectId: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<SourceFileSummary> {
  await assertProjectAccess(input.actor, input.projectId);
  assertAnonymousFileSize(input.actor, input.sizeBytes);
  const { type, mimeType } = validateUploadRequest({
    filename: input.originalFilename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  const owner = storageOwnerFromActor(input.actor);
  const parts = parseSourceObjectKey(input.objectKey);
  if (
    !parts ||
    parts.owner.kind !== owner.kind ||
    parts.owner.id !== owner.id ||
    parts.projectId !== input.projectId ||
    parts.extension !== extensionForType(type)
  ) {
    throw fileInvalid("The storage key is not valid for this project.");
  }

  const existing = await prisma.sourceFile.findUnique({
    where: { id: parts.sourceFileId },
  });
  if (existing) {
    return toSourceFileSummary(existing);
  }

  // R2/S3 HeadObject can briefly miss an object right after PutObject returns.
  const head = await waitForUploadedObject(input.objectKey);
  if (!head) {
    console.info("source_confirm_missing_object", {
      projectId: input.projectId,
      sourceFileId: parts.sourceFileId,
    });
    throw fileNotFound();
  }

  const source = await prisma.sourceFile.create({
    data: {
      id: parts.sourceFileId,
      projectId: input.projectId,
      type,
      originalFilename: input.originalFilename.trim(),
      objectKey: input.objectKey,
      mimeType,
      sizeBytes: BigInt(head.sizeBytes ?? input.sizeBytes),
      status: "UPLOADED",
    },
  });

  console.info("source_upload_completed", {
    projectId: input.projectId,
    sourceFileId: source.id,
    sizeBytes: Number(source.sizeBytes),
  });

  return toSourceFileSummary(source);
}

export async function transferSourceObject(input: {
  actor: Actor;
  objectKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  body: Buffer;
}): Promise<SourceFileSummary> {
  const { type, mimeType } = validateUploadRequest({
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });
  assertAnonymousFileSize(input.actor, input.sizeBytes);

  const owner = storageOwnerFromActor(input.actor);
  const parts = parseSourceObjectKey(input.objectKey);
  if (
    !parts ||
    parts.owner.kind !== owner.kind ||
    parts.owner.id !== owner.id ||
    parts.extension !== extensionForType(type)
  ) {
    throw fileInvalid("The storage key is not valid for this project.");
  }

  await assertProjectAccess(input.actor, parts.projectId);

  try {
    await getStorage().putObject({
      objectKey: input.objectKey,
      body: input.body,
      contentType: mimeType,
    });
  } catch (error) {
    console.error("source_upload_failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    throw uploadFailed();
  }

  // Record the source as soon as bytes are stored so confirm does not depend on
  // a follow-up HeadObject (R2 can briefly miss a just-written key).
  const existing = await prisma.sourceFile.findUnique({
    where: { id: parts.sourceFileId },
  });
  if (existing) {
    return toSourceFileSummary(existing);
  }

  const source = await prisma.sourceFile.create({
    data: {
      id: parts.sourceFileId,
      projectId: parts.projectId,
      type,
      originalFilename: input.filename.trim(),
      objectKey: input.objectKey,
      mimeType,
      sizeBytes: BigInt(input.sizeBytes),
      status: "UPLOADED",
    },
  });

  console.info("source_upload_completed", {
    projectId: parts.projectId,
    sourceFileId: source.id,
    sizeBytes: Number(source.sizeBytes),
  });

  return toSourceFileSummary(source);
}
