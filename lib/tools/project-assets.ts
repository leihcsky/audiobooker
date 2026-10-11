import { prisma } from "@/lib/db/prisma";
import { getStorage } from "@/lib/storage";

export type ProjectWithStoredObjects = {
  id: string;
  coverObjectKey: string | null;
  sourceFiles: Array<{ objectKey: string }>;
  audioFiles: Array<{ objectKey: string }>;
  exports: Array<{ objectKey: string | null }>;
};

export function objectKeysForProject(project: ProjectWithStoredObjects): string[] {
  return [
    ...project.sourceFiles.map((file) => file.objectKey),
    ...project.audioFiles.map((file) => file.objectKey),
    ...project.exports.flatMap((file) => (file.objectKey ? [file.objectKey] : [])),
    ...(project.coverObjectKey ? [project.coverObjectKey] : []),
  ];
}

export async function deleteProjectWithStoredObjects(
  project: ProjectWithStoredObjects,
): Promise<void> {
  const storage = getStorage();
  await Promise.all(
    objectKeysForProject(project).map((key) => storage.deleteObject(key).catch(() => undefined)),
  );
  await prisma.project.delete({ where: { id: project.id } });
}
