// Onboarding gate (FR10, ROADMAP Phase 3). First run (no prior events AND no
// stored placement) sends the learner through the onboarding flow before the
// main session; once done, the cached placement result (session/placement.ts)
// is the fast local "ready" signal, with a fallback scan of the event log so a
// device that already has history (but never wrote the local cache — e.g. a
// cleared localStorage) isn't sent back through placement. Ported from v1's
// apps/web/src/onboarding/useOnboarding.ts.

import { useEffect, useState } from "react";
import { getAll } from "../db/eventLog.ts";
import { loadPlacement } from "../session/placement.ts";

export type OnboardStatus = "loading" | "needed" | "ready";

/** Decide whether the learner needs onboarding. */
export function useOnboarding(): OnboardStatus {
  const [status, setStatus] = useState<OnboardStatus>("loading");

  useEffect(() => {
    if (loadPlacement()) {
      setStatus("ready");
      return;
    }
    void getAll().then((events) => {
      setStatus(events.length > 0 ? "ready" : "needed");
    });
  }, []);

  return status;
}
