import Link from "next/link";
import { notFound } from "next/navigation";
import { PronunciationEditor } from "@/components/pronunciation/pronunciation-editor";
import { StudioPageNav } from "@/components/studio/page-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppError } from "@/lib/api/errors";
import { requireSession } from "@/lib/auth/session";
import {
  getPronunciationPageForUser,
  MAX_PRONUNCIATIONS_PER_PROJECT,
  type PronunciationPageData,
} from "@/lib/pronunciation/pronunciation.service";
import { projectIdSchema } from "@/lib/validation/project";

type PronunciationPageProps = {
  params: Promise<{ projectId: string }>;
};

async function loadPage(projectId: string, userId: string): Promise<PronunciationPageData> {
  try {
    return await getPronunciationPageForUser(projectId, userId);
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

export default async function ProjectPronunciationPage({ params }: PronunciationPageProps) {
  const user = await requireSession();
  const { projectId } = await params;
  const parsedId = projectIdSchema.safeParse(projectId);
  if (!parsedId.success) {
    notFound();
  }

  const page = await loadPage(parsedId.data, user.id);
  const projectHref = `/studio/projects/${page.projectId}`;

  return (
    <main className="space-y-8">
      <StudioPageNav
        back={{ href: projectHref, label: `Back to ${page.title}` }}
        trail={[
          { label: "Projects", href: "/studio/projects" },
          { label: page.title, href: projectHref },
          { label: "Pronunciation" },
        ]}
      />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Pronunciation</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Tell the narrator how to say names and words it gets wrong. Each rule applies to the whole book
          the next time you generate.
        </p>
      </div>

      {!page.enabled ? (
        <Card>
          <CardHeader>
            <CardTitle>Part of the Creator plan</CardTitle>
            <CardDescription>
              {page.entries.length > 0
                ? "Your saved rules are kept but are not used when narrating. Upgrade to apply them again."
                : "Fix character names, places, and invented words once, and every chapter is read the same way."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:opacity-90"
            >
              See the Creator plan
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {page.enabled || page.entries.length > 0 ? (
        <PronunciationEditor
          projectId={page.projectId}
          initialEntries={page.entries}
          enabled={page.enabled}
          initialVoiceId={page.voiceId}
          speed={page.speed}
          maxEntries={MAX_PRONUNCIATIONS_PER_PROJECT}
        />
      ) : null}
    </main>
  );
}
