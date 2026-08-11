"use client";

// CLIENT-SIDE STEERING — edge case #92, and the client half of edge case #71.
//
//   #92: "PWA start_url bypasses middleware; offline serves cached '/' →
//         onboarded user sees marketing page. Fix: client-side steering in app
//         shell; start_url=/home."
//   #71: "'/' claimed by landing AND dashboard → '/'=landing stateless,
//         '/home'=dashboard; client-side guard DUPLICATES middleware (SW
//         bypasses it); IDB is truth, cookie a 7-day-ITP hint."
//
// WHY MIDDLEWARE IS NOT ENOUGH. A service worker intercepts the navigation
// before it ever reaches the network, so Next middleware never runs. An
// installed PWA whose start_url is /home is fine — but a learner who taps a
// shared link, a bookmark, or the browser's own home button lands on "/" and,
// offline, gets the cached marketing page. Middleware would have redirected
// them. The service worker made sure it never got the chance. So the guard
// must ALSO exist on the client, in the shell, where nothing can bypass it.
//
// WHY INDEXEDDB IS TRUTH AND A COOKIE IS ONLY A HINT (v3-D14). Safari's ITP
// caps script-written cookie lifetime at 7 days: an onboarded learner who
// returns on day 8 has no cookie but still has their whole event log. Deciding
// from the cookie would send them back to the marketing page and, worse, back
// through onboarding. So the cookie may only ever make the redirect FASTER;
// only the log may decide that it happens at all. This component therefore
// reads `meta.onboardedAt` — written when onboarding completes (M6) — and
// nothing else.
//
// WHY THIS RENDERS NOTHING AND DOES NOT GATE PAINT. The landing page is a real
// stateless page (v3-D14) and must render immediately for a genuine visitor.
// Blocking it behind an async IndexedDB read would put a spinner in front of
// every first-time visitor to protect a returning one — the wrong trade in the
// wrong direction. So "/" paints, and an onboarded learner is replaced a beat
// later. `router.replace`, not `push`: the landing page must not sit in the
// back stack, or Back from /home bounces off it forever.

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { openDb } from "@/lib/idb";

/** Where an onboarded learner belongs (v3-D14, and the PWA `start_url`). */
const HOME = "/home";

/**
 * Read the onboarding stamp straight from the log's meta store.
 *
 * Deliberately NOT `useLogState`: that hook models pending/empty/ready/broken
 * for RENDERING, and this component renders nothing. Here every failure has
 * exactly one correct outcome — stay on the landing page — because sending a
 * learner to a dashboard we cannot confirm is theirs is the worse error.
 */
async function readOnboardedAt(): Promise<number | null> {
  const db = await openDb();
  const row = await db.get("meta", "onboardedAt");
  return typeof row?.value === "number" ? row.value : null;
}

export function OnboardedSteer() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const onboardedAt = await readOnboardedAt();
        if (!alive) return;
        // Absent stamp = not onboarded = the landing page is correct.
        if (onboardedAt === null) return;
        router.replace(HOME);
      } catch {
        // IndexedDB unavailable (private mode, wedged, blocked upgrade). We
        // cannot prove the learner is onboarded, so we do not move them. A
        // visitor seeing the landing page is a non-event; an onboarded learner
        // seeing it is a papercut. Silently guessing wrong is worse than both.
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  return null;
}
