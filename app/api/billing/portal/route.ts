import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { createCustomerPortalUrl } from "@/lib/billing/checkout.service";
import { getSiteUrl } from "@/lib/tools/site";

const NO_STORE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.redirect(`${getSiteUrl()}/login`, { headers: NO_STORE });
  }
  try {
    const url = await createCustomerPortalUrl(userId);
    return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
  } catch (error) {
    console.error("billing_portal_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.redirect(`${getSiteUrl()}/studio/billing?portal=unavailable`, {
      headers: NO_STORE,
    });
  }
}
