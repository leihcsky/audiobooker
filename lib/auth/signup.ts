import { prisma } from "@/lib/db/prisma";
import { conflict } from "@/lib/api/errors";
import { hashPassword } from "@/lib/auth/password";
import type { SignupInput } from "@/lib/validation/auth";

export async function signupUser(input: SignupInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, passwordHash: true },
  });

  if (existing) {
    throw conflict(
      existing.passwordHash
        ? "An account with this email already exists."
        : "This email signs in with Google. Use Continue with Google.",
    );
  }

  const passwordHash = await hashPassword(input.password);
  const name = input.name?.trim() ? input.name.trim() : null;

  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });
}
