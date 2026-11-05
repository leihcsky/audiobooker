"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type MobileNavLink = {
  href: string;
  label: string;
  match?: (path: string) => boolean;
};

type MobileNavProps = {
  links: readonly MobileNavLink[];
  /** Extra actions under the links (sign in, open studio, etc.). */
  footer?: ReactNode;
};

export function MobileNav({ links, footer }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const panelId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const panel =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] md:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-foreground/30"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-x-0 top-0 border-b border-border bg-card shadow-lg">
              <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
                <p className="text-sm font-medium text-muted-foreground">Menu</p>
                <button
                  type="button"
                  className="inline-flex size-10 items-center justify-center rounded-md border border-border hover:bg-muted"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                >
                  <CloseIcon className="size-5" />
                </button>
              </div>
              <nav
                id={panelId}
                className="mx-auto max-h-[min(70vh,32rem)] w-full max-w-5xl overflow-y-auto px-4 pb-4 sm:px-6"
              >
                <ul className="space-y-1">
                  {links.map((link) => {
                    const active = link.match?.(pathname) ?? pathname === link.href;
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "block rounded-md px-3 py-3 text-base transition-colors hover:bg-muted",
                            active ? "bg-muted font-medium text-foreground" : "text-foreground",
                          )}
                        >
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {footer ? (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">{footer}</div>
                ) : null}
              </nav>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-md border border-border hover:bg-muted"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <CloseIcon className="size-5" /> : <MenuIcon className="size-5" />}
      </button>
      {panel}
    </div>
  );
}
