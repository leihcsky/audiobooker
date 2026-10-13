// Local testing only: adds purchased premium minutes to an account, as a
// minute pack would, without going through Waffo checkout. Usage:
//   npm run billing:grant-minutes -- you@example.com 30
import { randomUUID } from "node:crypto";
import prismaClient from "../generated/prisma/index.js";

const { PrismaClient } = prismaClient;

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("billing:grant-minutes is for local testing only.");
  }
  const [email, minutesArg] = process.argv.slice(2);
  const minutes = Number(minutesArg);
  if (!email || !Number.isInteger(minutes) || minutes <= 0 || minutes > 10_000) {
    throw new Error("Usage: npm run billing:grant-minutes -- <email> <minutes 1-10000>");
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new Error(`No account found for ${email}.`);
    }
    const id = randomUUID();
    await prisma.creditLedger.create({
      data: {
        userId: user.id,
        type: "ADMIN_ADJUSTMENT",
        bucket: "PURCHASED",
        amountSeconds: minutes * 60,
        referenceType: "admin",
        referenceId: id,
        idempotencyKey: `admin:${id}`,
        metadata: { source: "billing:grant-minutes" },
      },
    });
    console.log(`Added ${minutes} purchased premium minutes to ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
