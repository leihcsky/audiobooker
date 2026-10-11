"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ApiError = {
  success: false;
  error: { code: string; message: string };
};

type CreateResponse = {
  success: true;
  data: { project: { id: string } };
};

export function CreateProjectForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [planRequired, setPlanRequired] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPlanRequired(false);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? "");
    const description = String(formData.get("description") ?? "");

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description.trim() ? description : undefined,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | CreateResponse
      | ApiError
      | null;

    setPending(false);

    if (!response.ok || !payload || !payload.success) {
      setError(
        payload && !payload.success
          ? payload.error.message
          : "Unable to create project.",
      );
      setPlanRequired(Boolean(payload && !payload.success && payload.error.code === "PLAN_REQUIRED"));
      return;
    }

    router.push(`/studio/projects/${payload.data.project.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required maxLength={255} placeholder="My Audiobook" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          maxLength={5000}
          placeholder="Optional description"
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive">
          {error}
          {planRequired ? (
            <>
              {" "}
              <Link href="/pricing" className="font-medium underline">
                See plans
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create project"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/studio/projects")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
