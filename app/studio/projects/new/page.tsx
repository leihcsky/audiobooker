import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectForm } from "@/components/projects/create-project-form";
import { requireSession } from "@/lib/auth/session";
import { countUserProjects, getUserPlan } from "@/lib/billing/entitlements";

export default async function NewProjectPage() {
  const user = await requireSession();
  const [plan, used] = await Promise.all([getUserPlan(user.id), countUserProjects(user.id)]);
  const atLimit = used >= plan.maxProjects;

  return (
    <main className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Create Project</h1>
        <p className="mt-2 text-muted-foreground">
          Create the project, then upload your ebook. Voice and metadata come after that.
        </p>
      </div>
      {atLimit ? (
        <Card>
          <CardHeader>
            <CardTitle>Project limit reached</CardTitle>
            <CardDescription>
              Your {plan.name} plan holds {plan.maxProjects} projects. Delete a project you no longer
              need, or see plans for more room.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              See plans
            </Link>
            <Link
              href="/studio/projects"
              className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              Manage projects
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Project details</CardTitle>
            <CardDescription>Nothing here is required.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateProjectForm />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
