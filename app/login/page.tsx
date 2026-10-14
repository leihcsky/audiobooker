import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth/auth";
import { ClaimRedirect } from "@/components/auth/claim-redirect";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { LoginForm } from "@/components/auth/login-form";
import { isGoogleSignInEnabled } from "@/lib/auth/google-account";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Log in — Audiobooker",
  robots: { index: false },
};

type LoginPageProps = {
  searchParams: Promise<{ claim?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const { claim } = await searchParams;
  if (session?.user && claim) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-16">
        <ClaimRedirect projectId={claim} />
      </main>
    );
  }
  if (session?.user) {
    redirect("/studio");
  }
  const googleEnabled = isGoogleSignInEnabled();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-8 text-foreground">
        <BrandLogo />
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            {googleEnabled ? "Sign in to open Studio." : "Use your email and password to open Studio."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
            <div className="space-y-4">
              {googleEnabled ? <GoogleSignIn /> : null}
              <LoginForm />
            </div>
          </Suspense>
          <p className="mt-6 text-sm text-muted-foreground">
            Need an account?{" "}
            <Link
              href={claim ? `/signup?claim=${encodeURIComponent(claim)}` : "/signup"}
              className="font-medium text-foreground underline"
            >
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
