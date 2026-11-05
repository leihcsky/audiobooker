"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileNav, type MobileNavLink } from "@/components/nav/mobile-nav";
import { cn } from "@/lib/utils";

export const STUDIO_NAV_LINKS: readonly MobileNavLink[] = [
  { href: "/", label: "Home", match: () => false },
  { href: "/studio", label: "Dashboard", match: (path) => path === "/studio" },
  {
    href: "/studio/projects",
    label: "Projects",
    match: (path) => path.startsWith("/studio/projects"),
  },
  {
    href: "/studio/billing",
    label: "Billing",
    match: (path) => path.startsWith("/studio/billing"),
  },
];

export function StudioNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Studio">
      {STUDIO_NAV_LINKS.map((link) => {
        const active = link.match?.(pathname) ?? false;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors hover:bg-muted",
              active ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function StudioMobileNav() {
  return <MobileNav links={STUDIO_NAV_LINKS} />;
}
