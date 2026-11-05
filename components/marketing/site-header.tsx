"use client";

import Link from "next/link";
import { AccountMenu } from "@/components/account/account-menu";
import { BrandLogo } from "@/components/brand/logo";
import { MobileNav } from "@/components/nav/mobile-nav";

export const MARKETING_NAV_LINKS = [
  { href: "/", label: "Home", match: (path: string) => path === "/" },
  { href: "/audiobook-maker", label: "Maker" },
  { href: "/epub-to-audiobook", label: "EPUB" },
  { href: "/pdf-to-audiobook", label: "PDF" },
  { href: "/ebook-to-audiobook", label: "Ebook" },
  { href: "/pricing", label: "Pricing" },
] as const;

type SiteHeaderProps = {
  signedIn: boolean;
  email?: string | null;
};

export function SiteHeader({ signedIn, email }: SiteHeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ ["--site-header-height" as string]: "4.5rem" }}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
        <Link href="/" className="min-w-0 inline-flex items-center text-foreground">
          <BrandLogo
            markClassName="size-7 shrink-0 sm:size-8"
            wordmarkClassName="font-serif text-xl leading-none tracking-tight translate-y-px sm:text-2xl"
          />
        </Link>

        <nav className="hidden items-center gap-4 text-sm md:flex" aria-label="Primary">
          {MARKETING_NAV_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="hover:underline">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {signedIn ? (
            <>
              <Link
                href="/studio"
                className="hidden h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:inline-flex"
              >
                Open Studio
              </Link>
              <AccountMenu email={email ?? "Account"} />
            </>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm font-medium hover:underline sm:inline">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="hidden h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:inline-flex"
              >
                Get started
              </Link>
            </>
          )}
          <MobileNav
            links={MARKETING_NAV_LINKS}
            footer={
              signedIn ? (
                <Link
                  href="/studio"
                  className="flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Open Studio
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Get started
                  </Link>
                </>
              )
            }
          />
        </div>
      </div>
    </header>
  );
}
