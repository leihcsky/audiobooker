import Link from "next/link";
import { notFound } from "next/navigation";
import { DisclosureEditor } from "@/components/publish/disclosure-editor";
import { StudioPageNav } from "@/components/studio/page-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppError } from "@/lib/api/errors";
import { requireSession } from "@/lib/auth/session";
import {
  PUBLISH_PLATFORM_IDS,
  PUBLISH_PLATFORMS,
  isPublishPlatformId,
  type PublishPlatform,
} from "@/lib/publish/platforms";
import type { PublishCheckStatus } from "@/lib/publish/publish-readiness";
import { getPublishOverviewForUser, type PublishOverview } from "@/lib/publish/publish.service";
import { cn } from "@/lib/utils";
import { projectIdSchema } from "@/lib/validation/project";

type PublishPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ platform?: string }>;
};

const STATUS_STYLES: Record<PublishCheckStatus, { label: string; className: string }> = {
  pass: { label: "Ready", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  warn: { label: "Check", className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  fail: { label: "Fix", className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  todo: { label: "At upload", className: "bg-muted text-muted-foreground" },
};

async function loadPublishPage(projectId: string, userId: string): Promise<PublishOverview> {
  try {
    return await getPublishOverviewForUser(projectId, userId);
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

function uploadSteps(platform: PublishPlatform, projectId: string) {
  return [
    <>
      Fix the items above, then{" "}
      <Link href={`/studio/projects/${projectId}/export`} className="underline">
        export the audiobook
      </Link>{" "}
      and download the chapter files.
    </>,
    <>
      Sign in to{" "}
      <a href={platform.uploadUrl} target="_blank" rel="noreferrer" className="underline">
        {platform.name}
      </a>{" "}
      and start a new audiobook.
    </>,
    <>Enter the title, author, narrator credit, and description exactly as they appear in your metadata.</>,
    <>{platform.disclosureStep}</>,
    <>Paste the disclosure text above at the end of the store description, upload the cover and chapter files, and submit for review.</>,
  ];
}

export default async function ProjectPublishPage({ params, searchParams }: PublishPageProps) {
  const user = await requireSession();
  const [{ projectId }, { platform: platformParam }] = await Promise.all([params, searchParams]);
  const parsedId = projectIdSchema.safeParse(projectId);
  if (!parsedId.success) {
    notFound();
  }

  const overview = await loadPublishPage(parsedId.data, user.id);
  const platformId = isPublishPlatformId(platformParam) ? platformParam : "spotify";
  const platform = PUBLISH_PLATFORMS[platformId];
  const readiness = overview.readiness[platformId];
  const basePath = `/studio/projects/${overview.projectId}/publish`;

  return (
    <main className="space-y-8">
      <StudioPageNav
        back={{ href: `/studio/projects/${overview.projectId}`, label: `Back to ${overview.title}` }}
        trail={[
          { label: "Projects", href: "/studio/projects" },
          { label: overview.title, href: `/studio/projects/${overview.projectId}` },
          { label: "Publish" },
        ]}
      />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Publish your audiobook</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Pick a store, fix what the checklist flags, then follow the upload steps. AI-narrated
          audiobooks must be labeled as digital narration.
        </p>
      </div>

      <nav aria-label="Store" className="flex flex-wrap gap-2">
        {PUBLISH_PLATFORM_IDS.map((id) => {
          const blocking = overview.readiness[id].blockingCount;
          return (
            <Link
              key={id}
              href={`${basePath}?platform=${id}`}
              aria-current={id === platformId ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm",
                id === platformId ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
              )}
            >
              {PUBLISH_PLATFORMS[id].name}
              <span className="text-xs opacity-75">{blocking === 0 ? "ready" : `${blocking} to fix`}</span>
            </Link>
          );
        })}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>
            {readiness.blockingCount === 0
              ? `Ready for ${platform.name}`
              : `${readiness.blockingCount} ${readiness.blockingCount === 1 ? "item" : "items"} to fix for ${platform.name}`}
          </CardTitle>
          <CardDescription>Checked against {platform.name}&apos;s published requirements.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {readiness.checks.map((check) => {
              const style = STATUS_STYLES[check.status];
              return (
                <li key={check.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
                  <span
                    className={cn("mt-0.5 inline-flex w-20 shrink-0 justify-center rounded px-2 py-0.5 text-xs font-medium", style.className)}
                  >
                    {style.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="text-sm text-muted-foreground">{check.detail}</p>
                  </div>
                  {check.fix && check.status !== "pass" ? (
                    <Link
                      href={check.fix.href}
                      className="inline-flex h-9 shrink-0 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
                    >
                      {check.fix.label}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI narration disclosure</CardTitle>
          <CardDescription>
            Added to the description in every export. Paste it into the store description too.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DisclosureEditor projectId={overview.projectId} effectiveDisclosure={overview.effectiveAiDisclosure} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload to {platform.name}</CardTitle>
          {platform.distributionNote ? <CardDescription>{platform.distributionNote}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-5">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {uploadSteps(platform, overview.projectId).map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Requirements checked {platform.lastChecked} against:{" "}
            {platform.sources.map((source, index) => (
              <span key={source.url}>
                {index > 0 ? ", " : null}
                <a href={source.url} target="_blank" rel="noreferrer" className="underline">
                  {source.label}
                </a>
              </span>
            ))}
            . Stores change their rules; confirm before you submit.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
