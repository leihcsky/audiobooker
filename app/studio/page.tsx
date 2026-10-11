import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getUsageSummary } from "@/lib/billing/usage-summary";
import { PlanSummary } from "@/components/billing/plan-summary";
import { listProjectsForUser } from "@/lib/projects/project.service";
import { formatAudioDuration } from "@/lib/audio/format-duration";
import { getProjectProgressMap } from "@/lib/projects/project.progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { formatDate } from "@/lib/utils";

export default async function StudioDashboardPage() {
  const user = await requireSession();
  const { projects, pagination } = await listProjectsForUser(user.id, {
    page: 1,
    limit: 5,
  });
  const [progress, usage] = await Promise.all([
    getProjectProgressMap(projects.map((project) => project.id)),
    getUsageSummary(user.id),
  ]);
  const atProjectLimit = usage.projects.used >= usage.projects.limit;

  return (
    <main className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Your audiobooks</h1>
          <p className="mt-2 text-muted-foreground">
            {pagination.total === 1
              ? "1 project"
              : `${pagination.total} projects`}
          </p>
        </div>
        {atProjectLimit ? (
          <p className="max-w-xs text-right text-sm text-muted-foreground">
            You&apos;ve used all {usage.projects.limit} projects on {usage.plan.name}. Delete one or{" "}
            <Link href="/pricing" className="font-medium text-foreground underline">
              see plans
            </Link>{" "}
            to add another.
          </p>
        ) : (
          <Link
            href="/studio/projects/new"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create audiobook
          </Link>
        )}
      </div>

      <PlanSummary usage={usage} />

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Recent projects
          </h2>
          {pagination.total > projects.length ? (
            <Link href="/studio/projects" className="text-sm hover:underline">
              All projects
            </Link>
          ) : null}
        </div>
        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No projects yet. Create your first audiobook project.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const summary = progress.get(project.id);
              return (
                <Card key={project.id}>
                  <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{project.title}</CardTitle>
                      {project.author ? (
                        <p className="mt-1 text-sm text-muted-foreground">by {project.author}</p>
                      ) : null}
                    </div>
                    <ProjectStatusBadge status={project.status} />
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    {summary && summary.chapterCount > 0 ? (
                      <div className="space-y-1.5">
                        <div
                          className="h-1.5 overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={summary.percentage}
                          aria-label={`${project.title} narration progress`}
                        >
                          <div className="h-full bg-primary" style={{ width: `${summary.percentage}%` }} />
                        </div>
                        <p>
                          {summary.percentage}% complete · {summary.readyCount} of {summary.chapterCount} chapters
                          {summary.audioSeconds > 0 ? ` · ${formatAudioDuration(summary.audioSeconds)} of audio` : ""}
                        </p>
                      </div>
                    ) : (
                      <p>No chapters yet</p>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <span>Updated {formatDate(project.updatedAt)}</span>
                      <Link
                        href={`/studio/projects/${project.id}`}
                        className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
                      >
                        Continue
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
