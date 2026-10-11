import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAudioDuration } from "@/lib/audio/format-duration";
import type { ChapterHistoryEntry } from "@/lib/chapters/chapter-history.service";
import { formatDate } from "@/lib/utils";

const STATUS_LABEL: Record<ChapterHistoryEntry["status"], string> = {
  QUEUED: "Queued",
  PROCESSING: "Generating",
  COMPLETED: "Generated",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export function ChapterHistory({ entries }: { entries: ChapterHistoryEntry[] }) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Generation history</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="divide-y divide-border text-sm">
          {entries.map((entry) => (
            <li key={entry.jobId} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <span className="font-medium">
                  {entry.version != null ? `Version ${entry.version}` : STATUS_LABEL[entry.status]}
                </span>
                {entry.isCurrent ? (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Current</span>
                ) : null}
                <span className="ml-2 text-muted-foreground">
                  {[
                    entry.voiceName,
                    entry.tier === "PREMIUM" ? "Premium" : null,
                    entry.durationSeconds != null ? formatAudioDuration(entry.durationSeconds) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {entry.errorMessage ? (
                  <p className="mt-1 text-destructive">{entry.errorMessage}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-muted-foreground">{formatDate(entry.createdAt)}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
