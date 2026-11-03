/** Shared guards for local / allowlisted production billing admin scripts. */

export function assertBillingAdminAllowed(email) {
  const normalized = email.trim().toLowerCase();
  if (process.env.NODE_ENV !== "production") {
    return normalized;
  }
  const allowlist = (process.env.BILLING_TEST_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowlist.includes(normalized)) {
    throw new Error(
      "This script is blocked in production unless the email is listed in BILLING_TEST_EMAILS.",
    );
  }
  return normalized;
}
