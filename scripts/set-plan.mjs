// Local testing only: switches an account between Free and Creator until
// real billing (Creem) is connected. Usage:
//   npm run billing:set-plan -- you@example.com creator
//   npm run billing:set-plan -- you@example.com free
import prismaClient from "../generated/prisma/index.js";

const { PrismaClient } = prismaClient;
const PLAN_IDS = ["free", "creator"];

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("billing:set-plan is for local testing only.");
  }
  const [email, planId] = process.argv.slice(2);
  if (!email || !PLAN_IDS.includes(planId)) {
    throw new Error("Usage: npm run billing:set-plan -- <email> <free|creator>");
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new Error(`No account found for ${email}.`);
    }

    const now = new Date();
    await prisma.subscription.updateMany({
      where: { userId: user.id, provider: "manual", status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
      data: { status: "CANCELLED", currentPeriodEnd: now },
    });

    if (planId === "creator") {
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await prisma.subscription.create({
        data: {
          userId: user.id,
          provider: "manual",
          planId: "creator",
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
      console.log(`${email} is now on Creator until ${periodEnd.toISOString()}.`);
    } else {
      console.log(`${email} is now on Free.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
