import { canUsePublishMastering } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db/prisma";
import { detectCoverImage } from "@/lib/export/image";
import { getProjectForUser } from "@/lib/projects/project.service";
import { effectiveAiDisclosure } from "@/lib/publish/disclosure";
import { PUBLISH_PLATFORMS, type PublishPlatformId } from "@/lib/publish/platforms";
import {
  evaluatePublishReadiness,
  publishAudioState,
  type PublishReadiness,
  type PublishReadinessInput,
} from "@/lib/publish/publish-readiness";
import { getStorage } from "@/lib/storage";

export type PublishOverview = {
  projectId: string;
  title: string;
  aiDisclosure: string | null;
  effectiveAiDisclosure: string;
  readiness: Record<PublishPlatformId, PublishReadiness>;
};

async function backfillCoverSize(projectId: string, objectKey: string) {
  try {
    const detected = detectCoverImage(await getStorage().getObject(objectKey));
    if (!detected) {
      return null;
    }
    const { width, height } = detected.dimensions;
    await prisma.project.update({ where: { id: projectId }, data: { coverWidth: width, coverHeight: height } });
    return { width, height };
  } catch (error) {
    console.warn("cover_size_backfill_failed", {
      projectId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function getPublishOverviewForUser(projectId: string, userId: string): Promise<PublishOverview> {
  await getProjectForUser(projectId, userId);
  const now = new Date();
  const [project, latestMastered, canMaster] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        chapters: {
          orderBy: { orderIndex: "asc" },
          select: {
            title: true,
            included: true,
            audioOutdated: true,
            currentAudioFile: { select: { durationSeconds: true, createdAt: true } },
          },
        },
      },
    }),
    prisma.export.findFirst({
      where: {
        projectId,
        status: "COMPLETED",
        masteringPreset: { not: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, qcReport: true },
    }),
    canUsePublishMastering({ type: "user", userId }),
  ]);

  let coverSize =
    project.coverWidth !== null && project.coverHeight !== null
      ? { width: project.coverWidth, height: project.coverHeight }
      : null;
  if (!coverSize && project.coverObjectKey) {
    coverSize = await backfillCoverSize(project.id, project.coverObjectKey);
  }

  const input: PublishReadinessInput = {
    projectId: project.id,
    author: project.author,
    narrator: project.narrator,
    description: project.description,
    cover: {
      present: Boolean(project.coverObjectKey),
      width: coverSize?.width ?? null,
      height: coverSize?.height ?? null,
    },
    chapters: project.chapters.map((chapter) => ({
      title: chapter.title,
      included: chapter.included,
      hasAudio: Boolean(chapter.currentAudioFile),
      audioOutdated: chapter.audioOutdated,
      durationSeconds:
        chapter.currentAudioFile?.durationSeconds == null
          ? null
          : Number(chapter.currentAudioFile.durationSeconds.toString()),
    })),
    publishAudio: publishAudioState(latestMastered, project.chapters),
    canMaster,
  };

  return {
    projectId: project.id,
    title: project.title,
    aiDisclosure: project.aiDisclosure,
    effectiveAiDisclosure: effectiveAiDisclosure(project.aiDisclosure),
    readiness: {
      spotify: evaluatePublishReadiness(input, PUBLISH_PLATFORMS.spotify),
      "google-play": evaluatePublishReadiness(input, PUBLISH_PLATFORMS["google-play"]),
    },
  };
}
