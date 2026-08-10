// The sole server-side fold (v3-D08): PHP never re-implements engine
// logic, so folding a user's event log into atom state happens ONLY here,
// by calling the pure engine's own rebuild() — never a re-derivation.

import { rebuild, type AtomsMap } from "../../../packages/engine/src/rebuild.ts";
import type { DayConfig } from "../../../packages/engine/src/daybound.ts";
import type { DrillEvent } from "../../../packages/engine/src/types.ts";
import { canonicalOrder } from "./canonicalOrder.ts";

/**
 * Canonical-orders `events` (v3-D09 — arrival-order invariant, see
 * canonicalOrder.ts), then folds them via the engine's own rebuild(). This
 * composition, not rebuild() alone, is what the fold-runner actually
 * guarantees: the SAME AtomsMap regardless of how the server received the
 * events (single device, multi-device interleave, late arrival, replay).
 */
export function foldEvents(events: DrillEvent[], cfg?: DayConfig): AtomsMap {
  return rebuild(canonicalOrder(events), cfg);
}
