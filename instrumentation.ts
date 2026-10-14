export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  const { recoverInterruptedJobs } = await import("./lib/jobs/recovery");
  await recoverInterruptedJobs().catch((error: unknown) => {
    console.error("job_recovery_failed", {
      errorMessage: error instanceof Error ? error.message.slice(0, 400) : "unknown",
    });
  });
}
