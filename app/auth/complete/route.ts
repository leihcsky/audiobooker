import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { claimAfterSignIn, safeRedirectPath } from "@/lib/auth/post-sign-in";
import { peekAnonymousSessionId } from "@/lib/tools/anonymous-session";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login");
  }

  const params = new URL(request.url).searchParams;
  const projectId = await claimAfterSignIn({
    userId,
    sessionId: await peekAnonymousSessionId(),
    claimId: params.get("claim"),
  });
  redirect(projectId ? `/studio/projects/${projectId}` : safeRedirectPath(params.get("callbackUrl")));
}
