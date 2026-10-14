import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth/auth";
import { ClaimRedirect } from "@/components/auth/claim-redirect";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { SignupForm } from "@/components/auth/signup-form";
import { isGoogleSignInEnabled } from "@/lib/auth/google-account";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Sign up — Audiobooker",
  robots: { index: false },
};

type SignupPageProps = {
  searchParams: Promise<{ claim?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
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

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-8 text-foreground">
        <BrandLogo />
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            {claim
              ? "Create an account to save this audiobook and continue in Studio."
              : "Start a production workspace for your audiobooks."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
            <div className="space-y-4">
              {isGoogleSignInEnabled() ? <GoogleSignIn /> : null}
              <SignupForm />
            </div>
          </Suspense>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            By creating an account you agree to the{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={claim ? `/login?claim=${encodeURIComponent(claim)}` : "/login"}
              className="font-medium text-foreground underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
