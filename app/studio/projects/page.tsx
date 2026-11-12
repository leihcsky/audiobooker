import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listProjectsForUser } from "@/lib/projects/project.service";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { formatDate } from "@/lib/utils";

export default async function ProjectsPage() {
  const user = await requireSession();
  const { projects } = await listProjectsForUser(user.id, {
    page: 1,
    limit: 50,
  });

  return (
    <main className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Projects</h1>
          <p className="mt-2 text-muted-foreground">
            Your audiobook production workspaces.
          </p>
        </div>
        <Link
          href="/studio/projects/new"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No projects yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {projects.map((project) => (
            <li key={project.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Link
                  href={`/studio/projects/${project.id}`}
                  className="block break-words font-medium hover:underline"
                >
                  {project.title}
                </Link>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <ProjectStatusBadge status={project.status} />
                  <span>Updated {formatDate(project.updatedAt)}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/studio/projects/${project.id}`}
                  className="inline-flex h-8 flex-1 items-center justify-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted sm:flex-none"
                >
                  Open
                </Link>
                <DeleteProjectButton
                  projectId={project.id}
                  title={project.title}
                  label="Delete"
                  size="sm"
                  variant="outline"
                  className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive sm:flex-none"
                  redirectTo={null}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
