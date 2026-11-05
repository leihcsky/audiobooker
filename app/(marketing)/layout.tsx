import type { ReactNode } from "react";
import { auth } from "@/lib/auth/auth";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader signedIn={Boolean(session?.user)} email={session?.user?.email} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
