import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { AccountMenu } from "@/components/account/account-menu";
import { StudioNav } from "@/components/studio/studio-nav";
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
      <header className="border-b border-border bg-card/80">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-foreground" aria-label="Audiobooker home">
              <BrandLogo markClassName="size-7 shrink-0" wordmarkClassName="font-serif text-xl tracking-tight" />
            </Link>
            <StudioNav />
          </div>
          <AccountMenu email={session.user.email ?? "Account"} />
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">{children}</div>
      <footer className="mx-auto w-full max-w-5xl px-6 pb-8">
        <SupportContact />
      </footer>
    </div>
  );
}
