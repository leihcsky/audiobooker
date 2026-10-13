import { QC_CHECK_LABELS, type QcCheckId, type QcReport } from "@/lib/export/qc-report";
import { cn } from "@/lib/utils";

const CHECK_IDS = Object.keys(QC_CHECK_LABELS) as QcCheckId[];

function level(value: number | null): string {
  return value === null ? "silent" : `${value.toFixed(1)} dB`;
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

export function QcReportDetails({ report }: { report: QcReport }) {
  const failing = report.files.filter((file) => !file.pass);
  const summary =
    report.verdict === "pass"
      ? `Passed every check · ${report.files.length} files`
      : [
          failing.length > 0 ? `${failing.length} of ${report.files.length} files failed a check` : null,
          report.openingCredits.included ? null : "opening credits missing",
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <details className="mt-2 text-sm">
      <summary
        className={cn(
          "cursor-pointer",
          report.verdict === "pass" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
        )}
      >
        Quality check: {summary}
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-medium">File</th>
              <th className="py-1 pr-3 font-medium">Length</th>
              <th className="py-1 pr-3 font-medium">RMS</th>
              <th className="py-1 pr-3 font-medium">Peak</th>
              <th className="py-1 pr-3 font-medium">Start / end silence</th>
              <th className="py-1 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {report.files.map((file) => {
              const failed = CHECK_IDS.filter((id) => !file.checks[id]);
              return (
                <tr key={file.name}>
                  <td className="py-1.5 pr-3">{file.name}</td>
                  <td className="py-1.5 pr-3">{formatDuration(file.durationSeconds)}</td>
                  <td className="py-1.5 pr-3">{level(file.rmsDb)}</td>
                  <td className="py-1.5 pr-3">{level(file.peakDb)}</td>
                  <td className="py-1.5 pr-3">
                    {file.headSilenceSeconds.toFixed(2)} s / {file.tailSilenceSeconds.toFixed(2)} s
                  </td>
                  <td className={cn("py-1.5", failed.length > 0 && "text-destructive")}>
                    {failed.length === 0 ? "Pass" : failed.map((id) => QC_CHECK_LABELS[id]).join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">
          The full report is in the ZIP as QC-REPORT.csv.
        </p>
      </div>
    </details>
  );
}
