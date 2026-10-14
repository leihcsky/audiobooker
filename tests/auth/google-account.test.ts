import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const accountFindUnique = vi.hoisted(() => vi.fn());
const tx = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  account: { create: vi.fn() },
}));
const transaction = vi.hoisted(() => vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { account: { findUnique: accountFindUnique }, $transaction: transaction },
}));

import { isGoogleSignInEnabled, resolveGoogleUser, type GoogleIdentity } from "@/lib/auth/google-account";

const identity: GoogleIdentity = {
  sub: "google-sub-1",
  email: "Reader@Example.com",
  emailVerified: true,
  name: "Reader",
  picture: "https://lh3.googleusercontent.com/a/photo",
};

describe("resolveGoogleUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    accountFindUnique.mockResolvedValue(null);
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.create.mockResolvedValue({ id: "user-new", email: "reader@example.com" });
  });

  it("returns the user already linked to the Google account", async () => {
    accountFindUnique.mockResolvedValue({ user: { id: "user-1", email: "reader@example.com" } });

    await expect(resolveGoogleUser(identity)).resolves.toEqual({ id: "user-1", email: "reader@example.com" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("creates a verified user with the Google account when the email is new", async () => {
    await expect(resolveGoogleUser(identity)).resolves.toEqual({ id: "user-new", email: "reader@example.com" });

    const data = tx.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      email: "reader@example.com",
      name: "Reader",
      image: identity.picture,
      accounts: { create: { type: "oidc", provider: "google", providerAccountId: "google-sub-1" } },
    });
    expect(data.emailVerified).toBeInstanceOf(Date);
    expect(data).not.toHaveProperty("passwordHash");
  });

  it("links a verified email account and keeps its password and profile", async () => {
    const verifiedAt = new Date("2026-01-01T00:00:00Z");
    tx.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "reader@example.com",
      emailVerified: verifiedAt,
      name: "Existing Name",
      image: null,
    });

    await expect(resolveGoogleUser(identity)).resolves.toEqual({ id: "user-1", email: "reader@example.com" });

    const update = tx.user.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: "user-1" });
    expect(update.data).toEqual({ emailVerified: verifiedAt, name: "Existing Name", image: identity.picture });
    expect(tx.account.create).toHaveBeenCalledWith({
      data: { type: "oidc", provider: "google", providerAccountId: "google-sub-1", userId: "user-1" },
    });
  });

  it("clears the password when linking an account whose email was never verified", async () => {
    tx.user.findUnique.mockResolvedValue({
      id: "user-2",
      email: "reader@example.com",
      emailVerified: null,
      name: null,
      image: null,
    });

    await resolveGoogleUser(identity);

    const data = tx.user.update.mock.calls[0][0].data;
    expect(data.passwordHash).toBeNull();
    expect(data.emailVerified).toBeInstanceOf(Date);
    expect(data.name).toBe("Reader");
  });

  it("rejects a Google email that is not verified", async () => {
    await expect(resolveGoogleUser({ ...identity, emailVerified: false })).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("isGoogleSignInEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires both the client id and secret", () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "");
    expect(isGoogleSignInEnabled()).toBe(false);

    vi.stubEnv("AUTH_GOOGLE_SECRET", "secret");
    expect(isGoogleSignInEnabled()).toBe(true);
  });
});
