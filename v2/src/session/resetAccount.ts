// "Not you? switch account" (v2-D12) — a shared-device guard. v2 has no
// multi-profile support and Laravel per-account auth doesn't land until Phase
// 5, so for now this is a local-only reset: wipe this device's event log +
// atoms snapshot + persisted settings, and send the next learner through
// onboarding fresh. Confirmed destructive action — callers must gate this
// behind an explicit confirmation (see Home.tsx), never call it silently.

import { clearAll as clearEvents } from "../db/eventLog.ts";
import { clearSnapshot } from "../db/atoms.ts";
import { clearPlacement } from "./placement.ts";
import { clearAnchorHour } from "./anchor.ts";
import { clearGlossLang } from "./glossLang.ts";
import { DEFAULT_PACE_MODE } from "engine";
import { setPaceMode } from "./pace.ts";

/** Reset this device to a blank slate for a new learner. */
export async function resetForNewLearner(): Promise<void> {
  await Promise.all([clearEvents(), clearSnapshot()]);
  clearPlacement();
  clearAnchorHour();
  clearGlossLang();
  setPaceMode(DEFAULT_PACE_MODE);
}
