import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { AccountMenu } from "@/components/account/account-menu";
import { StudioMobileNav, StudioNav } from "@/components/studio/studio-nav";
import { BrandLogo } from "@/components/brand/logo";
import { SupportContact } from "@/components/marketing/support-contact";

export const dynamic = "force-dynamic";

export default async function StudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-full">
      <header
        className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
        style={{ ["--site-header-height" as string]: "4.5rem" }}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3 md:gap-8">
            <Link
              href="/"
              className="min-w-0 inline-flex items-center text-foreground"
              aria-label="Audiobooker home"
            >
              <BrandLogo
                markClassName="size-7 shrink-0 sm:size-8"
                wordmarkClassName="font-serif text-xl leading-none tracking-tight translate-y-px sm:text-2xl"
              />
            </Link>
            <StudioNav />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <AccountMenu email={session.user.email ?? "Account"} />
            <StudioMobileNav />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">{children}</div>
      <footer className="mx-auto w-full max-w-5xl px-6 pb-8">
        <SupportContact />
      </footer>
    </div>
  );
}
