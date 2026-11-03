// Adds purchased premium minutes without Waffo checkout. Locally any email
// works. In production only emails listed in BILLING_TEST_EMAILS are allowed.
//   npm run billing:grant-minutes -- you@example.com 30
import { randomUUID } from "node:crypto";
import prismaClient from "../generated/prisma/index.js";
import { assertBillingAdminAllowed } from "./billing-admin.mjs";

const { PrismaClient } = prismaClient;

async function main() {
  const [rawEmail, minutesArg] = process.argv.slice(2);
  const minutes = Number(minutesArg);
  if (!rawEmail || !Number.isInteger(minutes) || minutes <= 0 || minutes > 10_000) {
    throw new Error("Usage: npm run billing:grant-minutes -- <email> <minutes 1-10000>");
  }
  const email = assertBillingAdminAllowed(rawEmail);

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
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
