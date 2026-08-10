// v3-D25: bridge.ts's `bridgeItems`/`nextOpening` (S4 item generation) were
// never wired into any shipped v2 screen (grep-verified: zero references
// outside engine/src and engine/test) — atticked. `birthConnection` alone
// survives: rebuild.ts's fold calls it directly for `connection_born` /
// `junction_result` events, real wire events (invariant #2 territory). See
// RETIRED-TESTS.md for the full mapping.

import { describe, expect, it } from "vitest";
import { birthConnection } from "../src/bridge.ts";
import type { AtomState } from "../src/atom.ts";

describe("birthConnection", () => {
  it("births the connection atom for n (ref = from ayah), idempotently", () => {
    const atoms = new Map<string, AtomState>();
    const born = birthConnection(atoms, 12, 4);
    expect(born.kind).toBe("connection");
    expect(born.ref).toBe(4);
    expect(born.surah).toBe(12);
    expect(atoms.get("12:connection:4")).toBeDefined();
    // idempotent: second call returns the same, doesn't reset
    const mutated = { ...born, strength: 42 };
    atoms.set("12:connection:4", mutated);
    const again = birthConnection(atoms, 12, 4);
    expect(again.strength).toBe(42);
  });
});
