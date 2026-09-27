// GUARDS DECISIONS.md v3-D261: `lib/idb/schema.ts#canonicalKey`/
// `compareCanonical` (the client's own IndexedDB cursor order — what a real
// learner's session assembly folds) and `worker/fold-runner/src
// /canonicalOrder.ts#canonicalOrder` (the server fold, and the nightly
// `fold_determinism_check`) each hand-declared v3-D09's `(ts, deviceId,
// deviceSeq, id)` comparator INDEPENDENTLY, with nothing but a comment on
// each side asserting the other agreed — a confirmed
// `fold_determinism_check` P1 resets the 7-consecutive-green-nights launch
// gate, so an ordering disagreement between the two would be exactly the
// kind of silent divergence that check exists to catch.
//
// This test pins TWO things, not one: that there is now exactly ONE
// implementation (reference identity, not merely two copies that happen to
// agree today — `lib/progress/gateStateOf-agreement.test.ts`'s own
// precedent, v3-D212), reached from BOTH `apps/web` and
// `worker/fold-runner`; and that the merged function's real behavior still
// matches the fold-runner's own arrival-order-invariance property, via a
// direct cross-package import (`lib/sync/merge.test.ts`'s own established
// precedent for importing `worker/fold-runner/src` directly as a test
// oracle).

import { describe, expect, it } from "vitest";

import { canonicalKey, compareCanonical } from "./schema.ts";
import {
  canonicalKey as engineCanonicalKey,
  compareCanonical as engineCompareCanonical,
  canonicalOrder as engineCanonicalOrder,
} from "@engine/canonicalOrder.ts";
import { canonicalOrder as foldRunnerCanonicalOrder } from "../../../../worker/fold-runner/src/canonicalOrder.ts";
import type { DrillEvent } from "@engine/types.ts";

function ev(partial: Partial<DrillEvent> & { ts: number }): DrillEvent {
  return { type: "session_start", surah: 12, ayah: 1, rung: "S1", ...partial };
}

describe("canonicalKey/compareCanonical have exactly one implementation, shared by client and server", () => {
  it("lib/idb/schema.ts re-exports the SAME functions @engine/canonicalOrder.ts exports", () => {
    expect(canonicalKey).toBe(engineCanonicalKey);
    expect(compareCanonical).toBe(engineCompareCanonical);
  });

  it("worker/fold-runner/src/canonicalOrder.ts's canonicalOrder is the SAME function too", () => {
    expect(foldRunnerCanonicalOrder).toBe(engineCanonicalOrder);
  });

  it("the client's compareCanonical agrees with the server's canonicalOrder on a mixed multi-device set", () => {
    const events: DrillEvent[] = [
      ev({ id: "c", ts: 100, deviceId: "d1", deviceSeq: 3 }),
      ev({ id: "a", ts: 100, deviceId: "d1", deviceSeq: 1 }),
      ev({ id: "b", ts: 100, deviceId: "d1", deviceSeq: 2 }),
      ev({ id: "z", ts: 50, deviceId: "d2", deviceSeq: 9 }),
    ];
    const clientOrder = [...events].sort(compareCanonical).map((e) => e.id);
    const serverOrder = foldRunnerCanonicalOrder(events).map((e) => e.id);
    expect(clientOrder).toEqual(serverOrder);
    expect(clientOrder).toEqual(["z", "a", "b", "c"]);
  });
});
