"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type DeleteProjectButtonProps = {
  projectId: string;
  title: string;
  /** Button label. */
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  /**
   * Where to go after a successful delete.
   * Pass `null` to stay on the current page (e.g. the projects list).
   */
  redirectTo?: string | null;
};

export function DeleteProjectButton({
  projectId,
  title,
  label = "Delete",
  variant = "destructive",
  size = "default",
  className,
  redirectTo = "/studio/projects",
}: DeleteProjectButtonProps) {
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
    if (redirectTo) {
      router.push(redirectTo);
    }
    router.refresh();
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        title="Delete"
        description={`Delete “${title}”? This cannot be undone.`}
        onClose={() => {
          if (!pending) {
            setOpen(false);
          }
        }}
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
