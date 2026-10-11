"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ApiError = {
  success: false;
  error: { code: string; message: string };
};

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const claimId = searchParams.get("claim");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        ...(name ? { name } : {}),
      }),
    });

    const signupPayload = (await response.json().catch(() => null)) as
      | ApiError
      | { success: true; data: { claimedProjectId?: string | null } }
      | null;

    if (!response.ok) {
      setPending(false);
      setError(
        signupPayload && "error" in signupPayload
          ? signupPayload.error.message
          : "Unable to create account.",
      );
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setPending(false);

    if (!result || result.error) {
      setError("Account created. Please sign in.");
      router.push("/login");
      return;
    }

    const claimedId =
      (signupPayload && "success" in signupPayload && signupPayload.success
        ? signupPayload.data.claimedProjectId
        : null) ?? claimId;
    if (claimedId) {
      const claimResponse = await fetch(`/api/projects/${claimedId}/claim`, { method: "POST" });
      router.push(claimResponse.ok ? `/studio/projects/${claimedId}` : "/studio");
      router.refresh();
      return;
    }

    router.push("/studio");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
