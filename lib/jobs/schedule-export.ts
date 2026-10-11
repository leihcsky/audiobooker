import { after } from "next/server";
import { runExportJob } from "@/lib/jobs/export.runner";

export function scheduleExportJob(jobId: string) {
  after(() => {
    void runExportJob(jobId);
  });
}
