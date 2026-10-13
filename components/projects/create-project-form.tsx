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
        title: title.trim() ? title : undefined,
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
        <Label htmlFor="title">
          Audiobook title <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="title"
          name="title"
          maxLength={255}
          placeholder="Leave blank to use your ebook's title"
          aria-describedby="title-hint"
        />
        <p id="title-hint" className="text-xs text-muted-foreground">
          A title you type here stays when you upload your ebook. You can change it anytime.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          maxLength={5000}
          placeholder="A short note about this audiobook"
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
