import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

function actorKey(row) {
  if (row.userId) return `u:${row.userId}`;
  if (row.anonymousSessionId) return `a:${row.anonymousSessionId}`;
  if (row.projectId) return `p:${row.projectId}`;
  return `e:${row.id}`;
}

function pct(n, d) {
  if (!d) return null;
  return Math.round((n / d) * 1000) / 10;
}

async function main() {
  const [
    toolEvents,
    users,
    projects,
    anon,
    billing,
    ppb,
    quotes,
    sourceFiles,
    chapters,
    exports,
    jobs,
  ] = await Promise.all([
    prisma.toolEvent.count(),
    prisma.user.count(),
    prisma.project.count(),
    prisma.anonymousSession.count(),
    prisma.billingOrder.count(),
    prisma.payPerBookOrder.count(),
    prisma.payPerBookQuote.count(),
    prisma.sourceFile.count(),
    prisma.chapter.count(),
    prisma.export.count(),
    prisma.generationJob.count(),
  ]);

  const eventRange = await prisma.toolEvent.aggregate({
    _min: { createdAt: true },
    _max: { createdAt: true },
  });
  const userRange = await prisma.user.aggregate({
    _min: { createdAt: true },
    _max: { createdAt: true },
  });

  console.log(
    JSON.stringify(
      {
        inventory: {
          toolEvents,
          users,
          projects,
          anon,
          billing,
          ppb,
          quotes,
          sourceFiles,
          chapters,
          exports,
          jobs,
          eventRange,
          userRange,
        },
      },
      null,
      2,
    ),
  );

  if (toolEvents === 0 && users === 0) {
    console.log(JSON.stringify({ empty: true }));
    return;
  }

  const byName = await prisma.toolEvent.groupBy({
    by: ["name"],
    _count: { _all: true },
    orderBy: { _count: { name: "desc" } },
  });

  const events = await prisma.toolEvent.findMany({
    select: {
      id: true,
      name: true,
      path: true,
      userId: true,
      anonymousSessionId: true,
      projectId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const withUser = events.filter((e) => e.userId).length;
  const withAnon = events.filter((e) => e.anonymousSessionId && !e.userId).length;
  const withNeither = events.filter((e) => !e.userId && !e.anonymousSessionId).length;

  const actorsByEvent = new Map();
  for (const e of events) {
    const set = actorsByEvent.get(e.name) ?? new Set();
    set.add(actorKey(e));
    actorsByEvent.set(e.name, set);
  }

  const uniqueActorsByName = Object.fromEntries(
    [...actorsByEvent.entries()].map(([name, set]) => [name, set.size]),
  );

  console.log(
    JSON.stringify(
      {
        eventInventory: {
          byName: byName.map((r) => ({ name: r.name, count: r._count._all })),
          uniqueActorsByName,
          coverage: { withUser, withAnon, withNeither, total: events.length },
        },
      },
      null,
      2,
    ),
  );

  const FUNNEL = [
    "seo_tool_view",
    "tool_file_selected",
    "tool_upload_completed",
    "tool_parse_completed",
    "tool_voice_selected",
    "tool_generate_completed",
    "tool_export_completed",
    "tool_download",
    "tool_signup_clicked",
    "sign_up_completed",
    "tool_project_claimed",
    "quote_created",
    "checkout_started",
    "checkout_returned",
    "checkout_paid",
  ];

  // Actor-level first-touch sets
  const actorFirst = new Map(); // actor -> Map(eventName -> firstAt)
  for (const e of events) {
    const key = actorKey(e);
    let map = actorFirst.get(key);
    if (!map) {
      map = new Map();
      actorFirst.set(key, map);
    }
    if (!map.has(e.name)) map.set(e.name, e.createdAt);
  }

  function funnelFor(predicate) {
    const actors = [...actorFirst.entries()].filter(([key, map]) => predicate(key, map));
    const steps = [];
    let base = null;
    for (const step of FUNNEL) {
      const reached = actors.filter(([, map]) => map.has(step)).length;
      if (base === null) base = reached;
      const prev = steps.length ? steps[steps.length - 1].actors : reached;
      steps.push({
        step,
        actors: reached,
        fromPreviousPct: pct(reached, prev),
        fromTopPct: pct(reached, base),
      });
    }
    return { actorCount: actors.length, steps };
  }

  const overall = funnelFor(() => true);
  const anonOnly = funnelFor((key) => key.startsWith("a:"));
  const userOnly = funnelFor((key) => key.startsWith("u:"));

  // Time windows
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400000);
  const d30 = new Date(now.getTime() - 30 * 86400000);

  function funnelInWindow(since) {
    const windowEvents = events.filter((e) => e.createdAt >= since);
    const first = new Map();
    for (const e of windowEvents) {
      const key = actorKey(e);
      let map = first.get(key);
      if (!map) {
        map = new Map();
        first.set(key, map);
      }
      if (!map.has(e.name)) map.set(e.name, e.createdAt);
    }
    const actors = [...first.entries()];
    const steps = [];
    let base = null;
    for (const step of FUNNEL) {
      const reached = actors.filter(([, map]) => map.has(step)).length;
      if (base === null) base = reached;
      const prev = steps.length ? steps[steps.length - 1].actors : reached;
      steps.push({
        step,
        actors: reached,
        fromPreviousPct: pct(reached, prev),
        fromTopPct: pct(reached, base),
      });
    }
    return { actorCount: actors.length, steps };
  }

  // Path slice: top paths by seo_tool_view actors, then funnel for those actors
  const pathActors = new Map(); // path -> Set(actor)
  for (const e of events) {
    if (!e.path) continue;
    const set = pathActors.get(e.path) ?? new Set();
    set.add(actorKey(e));
    pathActors.set(e.path, set);
  }
  const topPaths = [...pathActors.entries()]
    .map(([path, set]) => ({ path, actors: set.size }))
    .sort((a, b) => b.actors - a.actors)
    .slice(0, 10);

  const pathFunnels = topPaths.map(({ path, actors: pathActorCount }) => {
    const set = pathActors.get(path);
    const result = funnelFor((key) => set.has(key));
    return { path, pathActorCount, ...result };
  });

  // Business calibration
  const paidBilling = await prisma.billingOrder.count({
    where: { status: "PAID" },
  });
  const paidUsers = await prisma.billingOrder.findMany({
    where: { status: "PAID" },
    select: { userId: true },
    distinct: ["userId"],
  });
  const paidPpb = await prisma.payPerBookOrder.count({
    where: { status: { in: ["PAID", "GENERATING", "COMPLETED"] } },
  });
  const quoteUsers = await prisma.payPerBookQuote.findMany({
    select: { userId: true },
    distinct: ["userId"],
  });
  const projectsWithAudio = await prisma.audioFile.groupBy({
    by: ["projectId"],
    where: { type: "CHAPTER_AUDIO" },
  });
  const claimedProjects = await prisma.project.count({
    where: { userId: { not: null }, anonymousSessionId: null },
  });
  const anonProjects = await prisma.project.count({
    where: { anonymousSessionId: { not: null }, userId: null },
  });
  const generateCompletedJobs = await prisma.generationJob.count({
    where: {
      type: { in: ["GENERATE_TTS", "GENERATE_PROJECT"] },
      status: "COMPLETED",
    },
  });
  const exportCompleted = await prisma.export.count({
    where: { status: "COMPLETED" },
  });

  // Drop-off between consecutive funnel steps (overall)
  const dropoffs = [];
  for (let i = 1; i < overall.steps.length; i++) {
    const prev = overall.steps[i - 1];
    const cur = overall.steps[i];
    const lost = prev.actors - cur.actors;
    dropoffs.push({
      from: prev.step,
      to: cur.step,
      fromActors: prev.actors,
      toActors: cur.actors,
      lost,
      dropPct: pct(lost, prev.actors),
      convertPct: cur.fromPreviousPct,
    });
  }
  dropoffs.sort((a, b) => (b.dropPct ?? 0) - (a.dropPct ?? 0));

  console.log(
    JSON.stringify(
      {
        funnels: {
          overall,
          anonOnly,
          userOnly,
          last7d: funnelInWindow(d7),
          last30d: funnelInWindow(d30),
        },
        pathFunnels,
        dropoffs,
        business: {
          users,
          paidBillingOrders: paidBilling,
          paidBillingUsers: paidUsers.length,
          payPerBookPaidish: paidPpb,
          quoteUsers: quoteUsers.length,
          projectsWithChapterAudio: projectsWithAudio.length,
          claimedProjects,
          anonProjects,
          generateCompletedJobs,
          exportCompleted,
        },
      },
      null,
      2,
    ),
  );
}

async function calibration() {
  const jobs = await prisma.generationJob.groupBy({
    by: ["type", "status"],
    _count: { _all: true },
  });
  const billing = await prisma.billingOrder.groupBy({
    by: ["status", "kind"],
    _count: { _all: true },
  });
  const ppb = await prisma.payPerBookOrder.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const quoteCount = await prisma.payPerBookQuote.count();
  const quotesWithOrder = await prisma.payPerBookOrder.findMany({
    where: { quoteId: { not: null } },
    select: { quoteId: true },
    distinct: ["quoteId"],
  });
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      userId: true,
      anonymousSessionId: true,
      status: true,
      createdAt: true,
      _count: { select: { sourceFiles: true, chapters: true, audioFiles: true, exports: true } },
    },
  });
  const projectFunnel = {
    created: projects.length,
    withSource: projects.filter((p) => p._count.sourceFiles > 0).length,
    withChapters: projects.filter((p) => p._count.chapters > 0).length,
    withAudio: projects.filter((p) => p._count.audioFiles > 0).length,
    withExport: projects.filter((p) => p._count.exports > 0).length,
    withUser: projects.filter((p) => p.userId).length,
  };
  const reliableEventFunnel = [
    "seo_tool_view",
    "tool_upload_completed",
    "tool_parse_completed",
    "tool_generate_started",
    "tool_generate_completed",
    "tool_project_claimed",
  ];
  const actorFirst = new Map();
  const events = await prisma.toolEvent.findMany({
    select: {
      id: true,
      name: true,
      userId: true,
      anonymousSessionId: true,
      projectId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  for (const e of events) {
    const key = actorKey(e);
    let map = actorFirst.get(key);
    if (!map) {
      map = new Map();
      actorFirst.set(key, map);
    }
    if (!map.has(e.name)) map.set(e.name, e.createdAt);
  }
  const actors = [...actorFirst.entries()];
  const reliableSteps = [];
  let base = null;
  for (const step of reliableEventFunnel) {
    const reached = actors.filter(([, map]) => map.has(step)).length;
    if (base === null) base = reached;
    const prev = reliableSteps.length ? reliableSteps[reliableSteps.length - 1].actors : reached;
    reliableSteps.push({
      step,
      actors: reached,
      fromPreviousPct: pct(reached, prev),
      fromTopPct: pct(reached, base),
    });
  }

  console.log(
    JSON.stringify(
      {
        calibration: {
          jobs,
          billing,
          ppb,
          quoteCount,
          quotesConvertedToOrder: quotesWithOrder.length,
          projectFunnel,
          reliableEventFunnel: reliableSteps,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => calibration())
  .catch((err) => {
    console.error("FATAL", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
