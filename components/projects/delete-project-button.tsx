"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type DeleteProjectButtonProps = {
  projectId: string;
  title: string;
};

export function DeleteProjectButton({ projectId, title }: DeleteProjectButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setError(null);
    setPending(true);

    const response = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
    });

    setPending(false);

    if (!response.ok) {
      setError("Unable to delete this project.");
      return;
    }

    setOpen(false);
    router.push("/studio/projects");
    router.refresh();
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete project
      </Button>
      <Dialog
        open={open}
        title="Delete project"
        description={`Delete “${title}”? This cannot be undone.`}
        onClose={() => setOpen(false)}
      >
        {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={pending}>
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
