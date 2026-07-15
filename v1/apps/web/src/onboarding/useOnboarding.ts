// Onboarding gate (FR10). On first run (no prior events at all), the user goes
// through placement before the main session. The placement result (carried map +
// start ayah) is persisted as an event and its carried set feeds the scheduler's
// learnCandidates so the main session starts on the right ayah.

import { useEffect, useState } from "react";
import { getAll } from "../db/eventLog.ts";

const PLACEMENT_KEY = "iman.placement"; // localStorage: the carried result (a cache)

export interface StoredPlacement {
  carriedAyat: number[];
  startAyah: number;
  ayahPerDay: number;
}

export type OnboardStatus = "loading" | "needs-placement" | "ready";

export function loadPlacement(): StoredPlacement | null {
  try {
    const raw = localStorage.getItem(PLACEMENT_KEY);
    return raw ? (JSON.parse(raw) as StoredPlacement) : null;
  } catch {
    return null;
  }
}

export function savePlacement(p: StoredPlacement): void {
  try {
    localStorage.setItem(PLACEMENT_KEY, JSON.stringify(p));
  } catch {
    /* non-fatal */
  }
}

/**
 * Decide whether to show placement. First run = no prior events AND no stored
 * placement. Once placement is done (or the user has history), status is "ready".
 */
export function useOnboarding(): {
  status: OnboardStatus;
  placement: StoredPlacement | null;
  completePlacement: (p: StoredPlacement) => void;
} {
  const [status, setStatus] = useState<OnboardStatus>("loading");
  const [placement, setPlacement] = useState<StoredPlacement | null>(null);

  useEffect(() => {
    const stored = loadPlacement();
    if (stored) {
      setPlacement(stored);
      setStatus("ready");
      return;
    }
    void getAll().then((events) => {
      // Any prior activity → skip placement (returning user already in-flight).
      if (events.length > 0) {
        setStatus("ready");
      } else {
        setStatus("needs-placement");
      }
    });
  }, []);

  const completePlacement = (p: StoredPlacement) => {
    savePlacement(p);
    setPlacement(p);
    setStatus("ready");
  };

  return { status, placement, completePlacement };
}
