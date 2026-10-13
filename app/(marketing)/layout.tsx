import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { AccountMenu } from "@/components/account/account-menu";
import { BrandLogo, LogoMark } from "@/components/brand/logo";

const NAV_LINKS = [
  { href: "/audiobook-maker", label: "Maker" },
  { href: "/epub-to-audiobook", label: "EPUB" },
  { href: "/pdf-to-audiobook", label: "PDF" },
  { href: "/ebook-to-audiobook", label: "Ebook" },
  { href: "/pricing", label: "Pricing" },
];

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="text-foreground">
            <BrandLogo />
          </Link>
          <nav className="hidden items-center gap-4 text-sm md:flex">
            {NAV_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:underline">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {session?.user ? (
              <>
                <Link
                  href="/studio"
                  className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Open Studio
                </Link>
                <AccountMenu email={session.user.email ?? "Account"} />
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium hover:underline">
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <p className="inline-flex items-center gap-2">
            <LogoMark className="size-6 shrink-0" />
            <span>Audiobooker — your online audiobook production studio.</span>
          </p>
          <nav className="flex flex-wrap gap-4">
            <Link href="/audiobook-maker" className="hover:underline">
              Audiobook Maker
            </Link>
            <Link href="/epub-to-audiobook" className="hover:underline">
              EPUB to Audiobook
            </Link>
            <Link href="/pdf-to-audiobook" className="hover:underline">
              PDF to Audiobook
            </Link>
            <Link href="/ebook-to-audiobook" className="hover:underline">
              Ebook to Audiobook
            </Link>
            <Link href="/publish-audiobook" className="hover:underline">
              Publishing Guide
            </Link>
            <Link href="/pricing" className="hover:underline">
              Pricing
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
