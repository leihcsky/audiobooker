// Prints conversion funnels from first-party data (ToolEvent, User, BillingOrder).
// Usage: npm run analytics:funnel -- --days 7
import prismaClient from "../generated/prisma/index.js";

const { PrismaClient } = prismaClient;

const TOOL_STEPS = [
  ["seo_tool_view", "Opened a tool page"],
  ["tool_upload_completed", "Uploaded a book"],
  ["tool_generate_started", "Started narration"],
  ["tool_download", "Downloaded audio"],
  ["tool_signup_clicked", "Clicked save / sign up"],
];

function parseDays(argv) {
  const index = argv.indexOf("--days");
  const value = index === -1 ? 7 : Number(argv[index + 1]);
  if (!Number.isInteger(value) || value < 1 || value > 365) {
    throw new Error("Usage: npm run analytics:funnel -- --days <1-365>");
  }
  return value;
}

function percent(part, whole) {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "-";
}

function printStep(label, count, previous, first) {
  const parts = [label.padEnd(26), String(count).padStart(7)];
  if (previous !== null) {
    parts.push(`${percent(count, previous).padStart(7)} of previous`, `${percent(count, first).padStart(7)} of start`);
  }
  console.log(`  ${parts.join("  ")}`);
}

function visitorKey(event) {
  return event.anonymousSessionId ?? event.userId;
}

async function toolFunnel(prisma, since) {
  const events = await prisma.toolEvent.findMany({
    where: { createdAt: { gte: since }, name: { in: TOOL_STEPS.map(([name]) => name) } },
    select: { name: true, anonymousSessionId: true, userId: true, projectId: true, path: true },
  });

  const byStep = new Map(TOOL_STEPS.map(([name]) => [name, new Set()]));
  const landingPath = new Map();
  const clickedProjects = new Map();
  for (const event of events) {
    const key = visitorKey(event);
    if (!key) {
      continue;
    }
    byStep.get(event.name).add(key);
    if (event.name === "seo_tool_view" && event.path && !landingPath.has(key)) {
      landingPath.set(key, event.path);
    }
    if (event.name === "tool_signup_clicked" && event.projectId) {
      clickedProjects.set(event.projectId, key);
    }
  }

  console.log("\nFree tool (unique visitors; each step counts only visitors who did the previous one)");
  let reached = byStep.get(TOOL_STEPS[0][0]);
  const first = reached.size;
  const reachedByStep = [reached];
  printStep(TOOL_STEPS[0][1], first, null, first);
  for (const [name, label] of TOOL_STEPS.slice(1)) {
    const previous = reached.size;
    reached = new Set([...byStep.get(name)].filter((key) => reached.has(key)));
    reachedByStep.push(reached);
    printStep(label, reached.size, previous, first);
  }

  const claims = await prisma.toolEvent.findMany({
    where: { createdAt: { gte: since }, name: "tool_project_claimed", projectId: { in: [...clickedProjects.keys()] } },
    select: { projectId: true },
    distinct: ["projectId"],
  });
  const savedVisitors = new Set(
    claims.map((claim) => clickedProjects.get(claim.projectId)).filter((key) => reached.has(key)),
  );
  printStep("Saved to an account", savedVisitors.size, reached.size, first);

  console.log("\nBy tool page (visitors who opened it)");
  const uploaded = reachedByStep[1];
  const paths = new Map();
  for (const [key, path] of landingPath) {
    const row = paths.get(path) ?? { views: 0, uploads: 0, saved: 0 };
    row.views += 1;
    row.uploads += uploaded.has(key) ? 1 : 0;
    row.saved += savedVisitors.has(key) ? 1 : 0;
    paths.set(path, row);
  }
  for (const [path, row] of [...paths].sort((a, b) => b[1].views - a[1].views)) {
    console.log(
      `  ${path.padEnd(26)}  views ${String(row.views).padStart(6)}  uploaded ${String(row.uploads).padStart(5)} (${percent(row.uploads, row.views)})  saved ${String(row.saved).padStart(4)}`,
    );
  }
}

async function accountFunnel(prisma, since) {
  const users = await prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true } });
  const ids = users.map((user) => user.id);

  const [fromTool, narrated, orders] = await Promise.all([
    prisma.toolEvent.findMany({
      where: { userId: { in: ids }, name: "tool_project_claimed" },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.toolEvent.findMany({
      where: { userId: { in: ids }, name: "tool_generate_started" },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.billingOrder.findMany({ where: { userId: { in: ids } }, select: { userId: true, status: true } }),
  ]);

  const checkout = new Set(orders.map((order) => order.userId));
  const paid = new Set(orders.filter((order) => order.status !== "PENDING").map((order) => order.userId));

  console.log("\nAccounts created in this period (each step counts any time after sign-up)");
  printStep("Signed up", ids.length, null, ids.length);
  console.log(`    (${fromTool.length} of them saved a project from a free tool)`);
  printStep("Started narration", narrated.length, ids.length, ids.length);
  printStep("Started checkout", checkout.size, ids.length, ids.length);
  printStep("Paid", paid.size, checkout.size, ids.length);
}

async function revenue(prisma, since) {
  const orders = await prisma.billingOrder.findMany({
    where: { paidAt: { gte: since }, status: { in: ["PAID", "REFUNDED"] } },
    select: { status: true, kind: true, amountUsd: true },
  });
  const kept = orders.filter((order) => order.status === "PAID");
  const total = kept.reduce((sum, order) => sum + Number(order.amountUsd), 0);
  const subscriptions = kept.filter((order) => order.kind === "SUBSCRIPTION").length;
  console.log(
    `\nRevenue paid in this period (before tax and fees): $${total.toFixed(2)} from ${kept.length} orders ` +
      `(${subscriptions} subscriptions, ${kept.length - subscriptions} minute packs; ${orders.length - kept.length} refunded)`,
  );
}

async function main() {
  const days = parseDays(process.argv.slice(2));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const prisma = new PrismaClient();
  try {
    console.log(`Audiobooker funnel: last ${days} days (since ${since.toISOString().slice(0, 16).replace("T", " ")} UTC)`);
    await toolFunnel(prisma, since);
    await accountFunnel(prisma, since);
    await revenue(prisma, since);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
