// Prints the measured numbers a public sample needs, for every project of one account.
// Usage: npm run samples:stats -- --email you@example.com
import prismaClient from "../generated/prisma/index.js";

const { PrismaClient } = prismaClient;

function parseEmail(argv) {
  const index = argv.indexOf("--email");
  const value = index === -1 ? "" : String(argv[index + 1] ?? "").trim().toLowerCase();
  if (!value.includes("@")) {
    throw new Error("Usage: npm run samples:stats -- --email <account email>");
  }
  return value;
}

function countWords(text) {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function formatDuration(seconds) {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min ${total % 60} s`;
}

function minutesBetween(start, end) {
  return ((end.getTime() - start.getTime()) / 60000).toFixed(1);
}

function megabytes(bytes) {
  return (Number(bytes) / (1024 * 1024)).toFixed(1);
}

async function generationRuns(prisma, projectId) {
  const parents = await prisma.generationJob.findMany({
    where: { projectId, type: "GENERATE_PROJECT" },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, createdAt: true, completedAt: true },
  });
  const runs = [];
  for (const parent of parents) {
    const children = await prisma.generationJob.findMany({
      where: { parentJobId: parent.id },
      select: { status: true, completedAt: true },
    });
    const done = children.filter((child) => child.status === "COMPLETED");
    const lastDone = [parent.completedAt, ...children.map((child) => child.completedAt)]
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    runs.push({ parent, total: children.length, done: done.length, lastDone });
  }
  return runs;
}

async function printProject(prisma, project) {
  const chapters = await prisma.chapter.findMany({
    where: { projectId: project.id, included: true },
    orderBy: { orderIndex: "asc" },
    select: {
      sourceText: true,
      selectedVoiceId: true,
      selectedSpeed: true,
      currentAudioFile: { select: { durationSeconds: true } },
    },
  });
  const words = chapters.reduce((sum, chapter) => sum + countWords(chapter.sourceText), 0);
  const narrated = chapters.filter((chapter) => chapter.currentAudioFile?.durationSeconds);
  const seconds = narrated.reduce((sum, chapter) => sum + Number(chapter.currentAudioFile.durationSeconds), 0);
  const voices = [...new Set(chapters.map((chapter) => `${chapter.selectedVoiceId ?? "default"} @ ${Number(chapter.selectedSpeed)}x`))];

  console.log(`\n${project.title}`);
  console.log(`  Project id           ${project.id}`);
  console.log(`  Author               ${project.author ?? "-"}`);
  console.log(`  Words (included)     ${words.toLocaleString("en-US")}`);
  console.log(`  Chapters (included)  ${chapters.length}  (${narrated.length} narrated)`);
  console.log(`  Audiobook length     ${formatDuration(seconds)}  (${Math.round(seconds)} s)`);
  console.log(`  Voice                ${voices.join(", ") || "-"}`);

  const runs = await generationRuns(prisma, project.id);
  if (runs.length === 0) {
    console.log("  Generation           no whole-book runs yet");
  }
  for (const [index, run] of runs.entries()) {
    const finished = run.parent.status === "COMPLETED" || run.parent.status === "FAILED" || run.parent.status === "CANCELLED";
    const elapsed = run.lastDone ? `${minutesBetween(run.parent.createdAt, run.lastDone)} min` : "-";
    const state = finished ? run.parent.status.toLowerCase() : `in progress, ${run.done}/${run.total} chapters`;
    console.log(
      `  Generation run ${index + 1}     ${elapsed}  (${state}; started ${run.parent.createdAt.toISOString()})`,
    );
  }

  const m4b = await prisma.export.findFirst({
    where: { projectId: project.id, type: "M4B", status: { in: ["COMPLETED", "EXPIRED"] } },
    orderBy: { createdAt: "desc" },
    select: { sizeBytes: true, durationSeconds: true, completedAt: true },
  });
  console.log(
    m4b?.sizeBytes
      ? `  Latest M4B           ${megabytes(m4b.sizeBytes)} MB, ${formatDuration(Number(m4b.durationSeconds ?? 0))}`
      : "  Latest M4B           not exported yet",
  );
}

async function main() {
  const email = parseEmail(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      throw new Error(`No account found for ${email}`);
    }
    const projects = await prisma.project.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, author: true },
    });
    if (projects.length === 0) {
      console.log("This account has no projects.");
    }
    for (const project of projects) {
      await printProject(prisma, project);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
