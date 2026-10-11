import { after } from "next/server";
import { runParseJob } from "@/lib/jobs/parse.runner";

export function scheduleParseJob(jobId: string) {
  after(() => {
    void runParseJob(jobId);
  });
}
