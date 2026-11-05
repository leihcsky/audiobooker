"use client";

import { useEffect, useState } from "react";

export function CopyableOrderId({ orderId }: { orderId: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex max-w-full flex-col items-end gap-1">
      <div className="flex max-w-full items-center gap-2">
        <span className="min-w-0 break-all font-mono text-xs">{orderId}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {failed ? (
        <span role="alert" className="text-xs font-normal text-destructive">
          Copy failed — select the ID and copy manually.
        </span>
      ) : null}
    </div>
  );
}
