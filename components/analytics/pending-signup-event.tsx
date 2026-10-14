"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/track";
import { SIGNUP_COOKIE } from "@/lib/analytics/signup-cookie";

export function PendingSignupEvent() {
  useEffect(() => {
    const prefix = `${SIGNUP_COOKIE}=`;
    const cookie = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
    if (!cookie) {
      return;
    }
    document.cookie = `${SIGNUP_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
    trackEvent("sign_up", { method: cookie.slice(prefix.length) === "google" ? "google" : "other" });
  }, []);

  return null;
}
