import { prisma } from "@/lib/db/prisma";

export const GOOGLE_PROVIDER = "google";

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
  picture?: string | null;
};

export type ResolvedGoogleUser = { id: string; email: string };

export function isGoogleSignInEnabled(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim());
}

function profileFields(identity: GoogleIdentity) {
  return {
    name: identity.name?.trim().slice(0, 255) || null,
    image: identity.picture?.trim().slice(0, 1024) || null,
  };
}

/** Maps a Google identity to our user (DATABASE.md §4.2), linking or creating as needed. */
export async function resolveGoogleUser(identity: GoogleIdentity): Promise<ResolvedGoogleUser> {
  const linked = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: GOOGLE_PROVIDER, providerAccountId: identity.sub } },
    select: { user: { select: { id: true, email: true } } },
  });
  if (linked) {
    return linked.user;
  }
  if (!identity.emailVerified) {
    throw new Error("Google email is not verified.");
  }

  const email = identity.email.trim().toLowerCase();
  const profile = profileFields(identity);
  const account = { type: "oidc", provider: GOOGLE_PROVIDER, providerAccountId: identity.sub };
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerified: true, name: true, image: true },
    });
    if (!existing) {
      return tx.user.create({
        data: { email, emailVerified: now, ...profile, accounts: { create: account } },
        select: { id: true, email: true },
      });
    }

    const clearPassword = existing.emailVerified === null;
    await tx.user.update({
      where: { id: existing.id },
      data: {
        emailVerified: existing.emailVerified ?? now,
        name: existing.name ?? profile.name,
        image: existing.image ?? profile.image,
        ...(clearPassword ? { passwordHash: null } : {}),
      },
    });
    await tx.account.create({ data: { ...account, userId: existing.id } });
    console.info("google_account_linked", { userId: existing.id, passwordCleared: clearPassword });
    return { id: existing.id, email: existing.email };
  });
}
