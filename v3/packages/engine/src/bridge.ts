// `birthConnection` only. v3-D25: the S4 item-generation surface here
// (`bridgeItems`/`nextOpening`/`BRIDGE_OPENING_COUNT`) was built and
// unit-tested in v2 but never wired into a shipped screen (grep-verified:
// zero references outside engine/src and engine/test) — atticked, per
// BUILD-PLAN.md's step-5 order. `birthConnection` alone is load-bearing:
// rebuild.ts's fold calls it directly for `connection_born`/`junction_result`
// events.

import { atomKey, initAtom, type AtomState } from "./atom.ts";

/**
 * Birth the connection atom for n→n+1 into an atoms map (ref = the `from` ayah).
 * Idempotent — if it already exists, returns the existing one unchanged.
 */
export function birthConnection(atoms: Map<string, AtomState>, surah: number, fromAyah: number): AtomState {
  const key = atomKey(surah, "connection", fromAyah);
  let a = atoms.get(key);
  if (!a) {
    a = initAtom(surah, "connection", fromAyah);
    atoms.set(key, a);
  }
  return a;
}
