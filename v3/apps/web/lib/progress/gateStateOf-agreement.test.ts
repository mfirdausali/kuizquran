// GUARDS DECISIONS.md v3-D211's own "NOT addressed" note:
// `components/macro/graphNodes.ts#gateStateOf()` duplicated this file's own
// `gateStateOf()` decision in a second, unexported local copy instead of
// importing it — the exact "two implementations of one decision" shape this
// file's own `GateState` docblock (rows.ts) exists to prevent for the ring
// and the table. Fixed at v3-D212: `graphNodes.ts` now imports and
// re-exports this function instead of re-declaring it.
//
// This test pins TWO things, not one: that there is now exactly one
// function (reference identity, not merely two functions that happen to
// agree today), and that the merged function's behavior is the one the
// ring's own tests (`test/macro-ring.test.tsx`, v3-D210) already rely on —
// so a future re-split cannot silently reintroduce the old divergence.

import { describe, expect, it } from "vitest";

import type { AtomState } from "@engine/atom.ts";
import { initAtom } from "@engine/atom.ts";
import { gateStateOf as rowsGateStateOf } from "./rows.ts";
import { gateStateOf as graphGateStateOf } from "@/components/macro/graphNodes.ts";

const NOW = Date.UTC(2026, 7, 11, 9, 0, 0);

describe("gateStateOf has exactly one implementation", () => {
  it("components/macro/graphNodes.ts imports the SAME function lib/progress/rows.ts exports", () => {
    expect(graphGateStateOf).toBe(rowsGateStateOf);
  });

  it("a failed gate reads \"failed\" even when gateDueAt has not (yet) been set", () => {
    // Real engine transitions never leave gateFails > 0 with gateDueAt ===
    // null (gate.ts#applyGateResult always sets both together on a failure;
    // demoteToLearn resets both together) — but the two PRIOR duplicate
    // implementations disagreed on exactly this combination, which is how
    // the duplication survived undetected. Pinning behavior, not just
    // identity, so a future re-duplication cannot reintroduce the
    // divergence silently.
    const atom: AtomState = { ...initAtom(103, "ayah", 1), encoded: true, gateFails: 1 };
    expect(rowsGateStateOf(atom, NOW)).toBe("failed");
    expect(graphGateStateOf(atom, NOW)).toBe("failed");
  });
});
