import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SIGNUP_COOKIE, SIGNUP_COOKIE_MAX_AGE_SECONDS } from "@/lib/analytics/signup-cookie";
import { auth } from "@/lib/auth/auth";
import { claimAfterSignIn, isNewOAuthAccount, safeRedirectPath } from "@/lib/auth/post-sign-in";
import { peekAnonymousSessionId } from "@/lib/tools/anonymous-session";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login");
  }

  const url = new URL(request.url);
  if (await isNewOAuthAccount(userId)) {
    (await cookies()).set(SIGNUP_COOKIE, "google", {
      maxAge: SIGNUP_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: url.protocol === "https:",
    });
  }

  const projectId = await claimAfterSignIn({
    userId,
    sessionId: await peekAnonymousSessionId(),
    claimId: url.searchParams.get("claim"),
  });
  redirect(projectId ? `/studio/projects/${projectId}` : safeRedirectPath(url.searchParams.get("callbackUrl")));
}
