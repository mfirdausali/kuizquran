// Build-plan step 14: the fold-runner is the SOLE server-side fold (v3-D08)
// — it must produce the exact same AtomsMap the pure engine's own
// rebuild() would, over the SAME canonical order, regardless of the
// arrival order the server actually received events in. This is invariant
// #2 ("the atom cache always agrees with a fresh fold of the log") made
// concrete for the multi-device, network-arrival-order case golden-log-
// parity.test.ts (in packages/engine) doesn't cover — that test proves
// rebuild() itself is correct over a FIXED, already-canonical log; this
// proves the composition (canonicalOrder + rebuild) is invariant to how
// the events actually arrived.

import { describe, expect, it } from "vitest";
import { foldEvents } from "../src/fold.ts";
import type { DrillEvent } from "../../../packages/engine/src/types.ts";

function ev(partial: Partial<DrillEvent> & { ts: number }): DrillEvent {
  return { type: "rung_complete", surah: 12, ayah: 4, rung: "S1", correct: true, structured: true, ...partial };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe("foldEvents — canonicalOrder + engine#rebuild composed", () => {
  it("produces an AtomsMap for a small real log", () => {
    const events: DrillEvent[] = [
      ev({ id: "e1", ts: 100, type: "rung_start", rung: "S1" }),
      ev({ id: "e2", ts: 200, type: "rung_complete", rung: "S1" }),
    ];
    const atoms = foldEvents(events);
    expect(atoms.size).toBeGreaterThan(0);
  });

  it("is ARRIVAL-ORDER INVARIANT: folding a shuffled log matches folding the canonical one, byte-identical, across many seeds", () => {
    const events: DrillEvent[] = [];
    for (let i = 0; i < 20; i++) {
      events.push(
        ev({
          id: `e${i}`,
          ts: 1000 + ((i * 53) % 800),
          deviceId: i % 2 === 0 ? "device-a" : "device-b",
          deviceSeq: i,
          type: i % 2 === 0 ? "rung_start" : "rung_complete",
          rung: "S1",
        }),
      );
    }
    const canonical = [...foldEvents(events).entries()];

    for (let seed = 0; seed < 15; seed++) {
      const shuffled = seededShuffle(events, seed);
      const folded = [...foldEvents(shuffled).entries()];
      expect(folded, `fold divergence at shuffle seed ${seed}`).toEqual(canonical);
    }
  });
});
