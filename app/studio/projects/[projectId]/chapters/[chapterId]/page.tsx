import { notFound } from "next/navigation";
import { AppError } from "@/lib/api/errors";
import { requireSession } from "@/lib/auth/session";
import { getPremiumBalance } from "@/lib/billing/credits.service";
import { listChapterHistoryForActor } from "@/lib/chapters/chapter-history.service";
import { findChapterNeighbors, getChapterForUser } from "@/lib/chapters/chapter.service";
import { ChapterPager } from "@/components/chapters/chapter-pager";
import { StudioPageNav } from "@/components/studio/page-nav";
import { findActiveProjectGenerationJob } from "@/lib/chapters/project-generation.service";
import { chapterIdSchema } from "@/lib/validation/upload";
import { projectIdSchema } from "@/lib/validation/project";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { ChapterEditor } from "@/components/chapters/chapter-editor";
import { ChapterHistory } from "@/components/chapters/chapter-history";
import { ChapterTtsPanel } from "@/components/chapters/chapter-tts-panel";
import type { ChapterDetail } from "@/lib/chapters/chapter.service";

type ChapterPageProps = {
  params: Promise<{ projectId: string; chapterId: string }>;
};

async function loadChapter(chapterId: string, userId: string): Promise<ChapterDetail> {
  try {
    return await getChapterForUser(chapterId, userId);
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === "CHAPTER_NOT_FOUND" || error.code === "FORBIDDEN")
    ) {
      notFound();
    }
    throw error;
  }
}

export default async function ChapterDetailPage({ params }: ChapterPageProps) {
  const user = await requireSession();
  const { projectId, chapterId } = await params;

  if (!projectIdSchema.safeParse(projectId).success || !chapterIdSchema.safeParse(chapterId).success) {
    notFound();
  }

  const chapter = await loadChapter(chapterId, user.id);
  if (chapter.projectId !== projectId) {
    notFound();
  }
  const [history, projectGeneration, neighbors, premium] = await Promise.all([
    listChapterHistoryForActor(chapter.id, { type: "user", userId: user.id }),
    findActiveProjectGenerationJob(projectId),
    findChapterNeighbors(projectId, chapter.orderIndex),
    getPremiumBalance(user.id),
  ]);
  const chapterNumber = String(chapter.orderIndex).padStart(2, "0");

  return (
    <main className="space-y-6">
      <StudioPageNav
        back={{ href: `/studio/projects/${projectId}`, label: `Back to ${chapter.projectTitle}` }}
        trail={[
          { label: "Projects", href: "/studio/projects" },
          { label: chapter.projectTitle, href: `/studio/projects/${projectId}` },
          { label: `Chapter ${chapterNumber}` },
        ]}
      />
      <div>
        <p className="text-sm text-muted-foreground">
          Chapter {chapterNumber}
        </p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">{chapter.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <ProjectStatusBadge status={chapter.status} />
          <span>{chapter.wordCount.toLocaleString()} words</span>
          <span>{chapter.characterCount.toLocaleString()} characters</span>
        </div>
      </div>

      <ChapterTtsPanel
        chapter={chapter}
        projectGenerating={Boolean(projectGeneration)}
        premiumAvailableSeconds={premium.balance.availableSeconds}
      />

      <ChapterEditor
        key={`${chapter.id}:${chapter.title}:${chapter.characterCount}`}
        chapterId={chapter.id}
        title={chapter.title}
        sourceText={chapter.sourceText}
        hasAudio={chapter.hasAudio}
        locked={chapter.status === "GENERATING"}
      />

      <ChapterHistory entries={history} />

      <ChapterPager projectId={projectId} previous={neighbors.previous} next={neighbors.next} />
    </main>
  );
}
