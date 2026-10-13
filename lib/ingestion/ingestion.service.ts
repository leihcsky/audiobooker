import { FILE_LIMITS } from "@/lib/config/limits";
import { AppError, parseFailed } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { parseDocument } from "@/lib/parser/registry";
import { titleAfterParse } from "@/lib/projects/project-title";
import { getStorage } from "@/lib/storage";
import { buildCoverObjectKey } from "@/lib/storage/keys";
import { storageOwnerFromProject } from "@/lib/tools/storage-owner";
import { validateCoverImage } from "@/lib/export/image";
import type { ParsedCover, ParsedDocument } from "@/lib/parser/types";

function validateParsedDocument(parsed: ParsedDocument) {
  if (parsed.chapters.length === 0) {
    throw new AppError("NO_CONTENT_EXTRACTED", "No readable chapter text was found.", 422);
  }
  if (parsed.chapters.length > FILE_LIMITS.MAX_CHAPTERS) {
    throw parseFailed("The document has too many chapters.");
  }

  let total = 0;
  for (const chapter of parsed.chapters) {
    if (chapter.content.length > FILE_LIMITS.MAX_CHAPTER_TEXT_LENGTH) {
      throw parseFailed("A chapter exceeds the text length limit.");
    }
    total += chapter.content.length;
  }
  if (total > FILE_LIMITS.MAX_TOTAL_EXTRACTED_TEXT) {
    throw parseFailed("The extracted text exceeds the size limit.");
  }
}

export async function ingestSourceFile(input: {
  projectId: string;
  sourceFileId: string;
  jobId: string;
}) {
  const started = Date.now();
  const source = await prisma.sourceFile.findUnique({
    where: { id: input.sourceFileId },
  });
  if (!source || source.projectId !== input.projectId) {
    throw new AppError("SOURCE_FILE_NOT_FOUND", "Source file not found.", 404);
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
  });
  if (!project) {
    throw new AppError("PROJECT_NOT_FOUND", "Project not found.", 404);
  }

  console.info("parse_started", {
    projectId: input.projectId,
    sourceFileId: input.sourceFileId,
    jobId: input.jobId,
    sizeBytes: Number(source.sizeBytes),
  });

  const buffer = await getStorage().getObject(source.objectKey);
  const parsed = await parseDocument(source.type, {
    filename: source.originalFilename,
    mimeType: source.mimeType,
    buffer,
  });
  validateParsedDocument(parsed);

  await prisma.$transaction(async (tx) => {
    await tx.chapter.deleteMany({ where: { projectId: input.projectId } });
    await tx.chapter.createMany({
      data: parsed.chapters.map((chapter) => ({
        projectId: input.projectId,
        title: chapter.title.slice(0, 500),
        orderIndex: chapter.order,
        sourceText: chapter.content,
        characterCount: chapter.content.length,
        status: "PENDING",
      })),
    });

    await tx.sourceFile.update({
      where: { id: source.id },
      data: { status: "PARSED" },
    });

    await tx.project.update({
      where: { id: input.projectId },
      data: {
        status: "READY",
        title: titleAfterParse({
          current: project.title,
          titleSetByUser: project.titleSetByUser,
          bookTitle: parsed.metadata.title,
          filename: source.originalFilename,
        }),
        author: project.author ?? parsed.metadata.author ?? null,
        language: parsed.metadata.language
          ? parsed.metadata.language.slice(0, 20)
          : project.language,
      },
    });
  });

  if (parsed.cover) {
    await saveExtractedCover(project, parsed.cover).catch(() => undefined);
  }

  console.info("parse_completed", {
    projectId: input.projectId,
    sourceFileId: input.sourceFileId,
    jobId: input.jobId,
    durationMs: Date.now() - started,
    chapterCount: parsed.chapters.length,
  });
  console.info("chapters_created", {
    projectId: input.projectId,
    sourceFileId: input.sourceFileId,
    jobId: input.jobId,
    chapterCount: parsed.chapters.length,
  });
}

async function saveExtractedCover(
  project: { id: string; userId: string | null; anonymousSessionId: string | null },
  cover: ParsedCover,
): Promise<void> {
  const detected = validateCoverImage(cover.buffer);
  const objectKey = buildCoverObjectKey({
    owner: storageOwnerFromProject(project),
    projectId: project.id,
    extension: detected.kind,
  });
  await getStorage().putObject({
    objectKey,
    body: cover.buffer,
    contentType: detected.contentType,
  });
  await prisma.project.update({
    where: { id: project.id },
    data: {
      coverObjectKey: objectKey,
      coverWidth: detected.dimensions.width,
      coverHeight: detected.dimensions.height,
    },
  });
}
