// Pace mode persistence (v2-D09) — mid-surah editable, sticky across sessions.
// Pure localStorage IO; the pace SCIENCE (budgetMin, ceilings, gate tolerance)
// lives entirely in engine/src/pace.ts (invariant #6: logic lives in the engine).

import { DEFAULT_PACE_MODE, type PaceMode } from "engine";

const KEY = "iman-pace-mode";

function isPaceMode(v: string | null): v is PaceMode {
  return v === "steady" || v === "sprint" || v === "maintain";
}

/** The learner's persisted pace mode, or the default if never set. */
export function getPaceMode(): PaceMode {
  if (typeof localStorage === "undefined") return DEFAULT_PACE_MODE;
  const v = localStorage.getItem(KEY);
  return isPaceMode(v) ? v : DEFAULT_PACE_MODE;
}

/** Persist a pace mode change (mid-surah editable — takes effect next plan()). */
export function setPaceMode(mode: PaceMode): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, mode);
}
