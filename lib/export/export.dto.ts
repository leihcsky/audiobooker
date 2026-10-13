import type { Export, ExportStatus, ExportType } from "@/generated/prisma";
import { parseQcReport, type QcReport } from "@/lib/export/qc-report";

export type ExportDto = {
  id: string;
  type: ExportType;
  status: ExportStatus;
  format: string;
  sizeBytes: string | null;
  durationSeconds: number | null;
  errorMessage: string | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
  jobId: string | null;
  masteringPreset: string | null;
  qcReport: QcReport | null;
};

export function toExportDto(record: Export): ExportDto {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    format: record.format,
    sizeBytes: record.sizeBytes == null ? null : record.sizeBytes.toString(),
    durationSeconds:
      record.durationSeconds == null ? null : Number(record.durationSeconds.toString()),
    errorMessage: record.errorMessage,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    jobId: record.generationJobId,
    masteringPreset: record.masteringPreset,
    qcReport: parseQcReport(record.qcReport),
  };
}
