import Link from "next/link";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/api/errors";
import { requireSession } from "@/lib/auth/session";
import { getPremiumBalance } from "@/lib/billing/credits.service";
import { getProjectDetailForUser } from "@/lib/projects/project.detail";
import { projectIdSchema } from "@/lib/validation/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditProjectForm } from "@/components/projects/edit-project-form";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { ProjectWorkspace } from "@/components/projects/project-workspace";
import { SourceIngestionPanel } from "@/components/projects/source-ingestion-panel";
import { StudioPageNav } from "@/components/studio/page-nav";
import { formatDate } from "@/lib/utils";
import type { ProjectDetailDto } from "@/lib/projects/project.detail";

type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
};

async function loadDetail(projectId: string, userId: string): Promise<ProjectDetailDto> {
  try {
    return await getProjectDetailForUser(projectId, userId);
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === "PROJECT_NOT_FOUND" || error.code === "FORBIDDEN")
    ) {
      notFound();
    }

    throw error;
  }
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const user = await requireSession();
  const { projectId } = await params;
  const parsedId = projectIdSchema.safeParse(projectId);

  if (!parsedId.success) {
    notFound();
  }

  const [detail, premium] = await Promise.all([
    loadDetail(parsedId.data, user.id),
    getPremiumBalance(user.id),
  ]);
  const { project } = detail;
  const narrating =
    detail.generation?.job.status === "QUEUED" ||
    detail.generation?.job.status === "PROCESSING" ||
    detail.chapters.some((chapter) => chapter.status === "GENERATING");

  return (
    <main className="space-y-8">
      <StudioPageNav
        back={{ href: "/studio/projects", label: "All projects" }}
        trail={[{ label: "Projects", href: "/studio/projects" }, { label: project.title }]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">{project.title}</h1>
          {project.author ? <p className="mt-1 text-muted-foreground">by {project.author}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <ProjectStatusBadge status={project.status} />
            <span>Created {formatDate(project.createdAt)}</span>
            <span>Updated {formatDate(project.updatedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/studio/projects/${project.id}/pronunciation`}
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm hover:bg-muted"
          >
            Pronunciation
          </Link>
          <Link
            href={`/studio/projects/${project.id}/export`}
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm hover:bg-muted"
          >
            Export
          </Link>
          <Link
            href={`/studio/projects/${project.id}/publish`}
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm hover:bg-muted"
          >
            Publish
          </Link>
          <DeleteProjectButton projectId={project.id} title={project.title} />
        </div>
      </div>

      {project.description ? (
        <p className="max-w-3xl text-muted-foreground">{project.description}</p>
      ) : null}

      {detail.chapters.length > 0 ? (
        <ProjectWorkspace
          projectId={project.id}
          chapters={detail.chapters}
          progress={detail.progress}
          generation={detail.generation}
          premiumAvailableSeconds={premium.balance.availableSeconds}
        />
      ) : null}

      <SourceIngestionPanel
        projectId={project.id}
        sourceFiles={detail.sourceFiles}
        latestParseJob={detail.latestParseJob}
        chapterCount={detail.chapters.length}
        narrating={narrating}
      />

      <Card>
        <CardHeader>
          <CardTitle>Edit project</CardTitle>
        </CardHeader>
        <CardContent>
          <EditProjectForm project={project} />
        </CardContent>
      </Card>
    </main>
  );
}
