import type { Project } from "@/generated/prisma";
import { effectiveAiDisclosure } from "@/lib/publish/disclosure";

export type ProjectDto = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  language: string;
  narrator: string | null;
  publisher: string | null;
  copyright: string | null;
  aiDisclosure: string | null;
  effectiveAiDisclosure: string;
  hasCover: boolean;
  status: Project["status"];
  createdAt: string;
  updatedAt: string;
};

export function toProjectDto(project: Project): ProjectDto {
  return {
    id: project.id,
    title: project.title,
    author: project.author,
    description: project.description,
    language: project.language,
    narrator: project.narrator,
    publisher: project.publisher,
    copyright: project.copyright,
    aiDisclosure: project.aiDisclosure,
    effectiveAiDisclosure: effectiveAiDisclosure(project.aiDisclosure),
    hasCover: Boolean(project.coverObjectKey),
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
