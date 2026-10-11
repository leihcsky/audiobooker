import { after } from "next/server";
import { runProjectGeneration } from "@/lib/jobs/project-generation.runner";
import { runTtsJob } from "@/lib/jobs/tts.runner";

export function scheduleTtsJob(jobId: string) {
  const start = () => {
    void runTtsJob(jobId);
  };
  start();
  after(start);
}

export function scheduleProjectGeneration(jobId: string) {
  const start = () => {
    void runProjectGeneration(jobId);
  };
  start();
  after(start);
}
