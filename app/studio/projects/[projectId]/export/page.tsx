import { notFound } from "next/navigation";
import { StudioPageNav } from "@/components/studio/page-nav";
import { AppError } from "@/lib/api/errors";
import { requireSession } from "@/lib/auth/session";
import { canUsePublishMastering } from "@/lib/billing/entitlements";
import { ExportStudioPanel } from "@/components/export/export-studio-panel";
import {
  getExportReadinessForUser,
  listExportsForUser,
  type ExportReadinessDto,
} from "@/lib/export/export.service";
import type { ExportDto } from "@/lib/export/export.dto";
import { getProjectForUser } from "@/lib/projects/project.service";
import type { ProjectDto } from "@/lib/projects/project.dto";
import { projectIdSchema } from "@/lib/validation/project";

type ExportPageProps = {
  params: Promise<{ projectId: string }>;
};

type ExportPageData = {
  project: ProjectDto;
  readiness: ExportReadinessDto;
  exports: ExportDto[];
  canMaster: boolean;
};

async function loadExportPage(projectId: string, userId: string): Promise<ExportPageData> {
  try {
    const [project, readiness, exports, canMaster] = await Promise.all([
      getProjectForUser(projectId, userId),
      getExportReadinessForUser(projectId, userId),
      listExportsForUser(projectId, userId),
      canUsePublishMastering({ type: "user", userId }),
    ]);
    return { project, readiness, exports, canMaster };
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

export default async function ProjectExportPage({ params }: ExportPageProps) {
  const user = await requireSession();
  const { projectId } = await params;
  const parsedId = projectIdSchema.safeParse(projectId);
  if (!parsedId.success) {
    notFound();
  }

  const { project, readiness, exports, canMaster } = await loadExportPage(parsedId.data, user.id);

  return (
    <main className="space-y-8">
      <StudioPageNav
        back={{ href: `/studio/projects/${project.id}`, label: `Back to ${project.title}` }}
        trail={[
          { label: "Projects", href: "/studio/projects" },
          { label: project.title, href: `/studio/projects/${project.id}` },
          { label: "Export" },
        ]}
      />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Export audiobook</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Review metadata, add a cover, and package the generated chapter audio as MP3 or M4B.
        </p>
      </div>
      <ExportStudioPanel project={project} readiness={readiness} exports={exports} canMaster={canMaster} />
    </main>
  );
}
