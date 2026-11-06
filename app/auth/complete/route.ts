import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SIGNUP_COOKIE, SIGNUP_COOKIE_MAX_AGE_SECONDS } from "@/lib/analytics/signup-cookie";
import { auth } from "@/lib/auth/auth";
import { claimAfterSignIn, isNewOAuthAccount, safeRedirectPath } from "@/lib/auth/post-sign-in";
import { peekAnonymousSessionId } from "@/lib/tools/anonymous-session";
import { recordToolEvent } from "@/lib/tools/events";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login");
  }

  const url = new URL(request.url);
  const anonymousSessionId = await peekAnonymousSessionId();
  if (await isNewOAuthAccount(userId)) {
    (await cookies()).set(SIGNUP_COOKIE, "google", {
      maxAge: SIGNUP_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: url.protocol === "https:",
    });
    await recordToolEvent({
      actor: { type: "user", userId },
      anonymousSessionId,
      name: "sign_up_completed",
      metadata: { method: "google", hadAnonymousSession: Boolean(anonymousSessionId) },
    });
  }

  const projectId = await claimAfterSignIn({
    userId,
    sessionId: anonymousSessionId,
    claimId: url.searchParams.get("claim"),
  });
  redirect(projectId ? `/studio/projects/${projectId}` : safeRedirectPath(url.searchParams.get("callbackUrl")));
}
