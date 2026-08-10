// The 2-minute floor session (FR9). The smallest viable session — ALWAYS offered,
// ALWAYS finishable, NEVER empty. Priority: a due cold gate > the single riskiest
// due review > a warm-up on the strongest carried atom (so even "nothing due"
// still gives one quick, winnable touch). Keeps the habit alive on the worst days.
// Pure; `now` passed in.

import type { AtomState } from "./atom.ts";
import { forgettingRisk } from "./strength.ts";
import { dueGates } from "./gate.ts";
import type { DayConfig } from "./daybound.ts";

export interface FloorItem {
  kind: "gate" | "review" | "warmup";
  atomKey: string;
  ref: number;
  /** Estimated minutes (kept ≤ ~2 total). */
  estMin: number;
}

const CAP_MIN = 2;

/**
 * Build the floor-session queue: at most ~2 minutes, never empty. Returns 1–2
 * items chosen for maximum value in minimal time.
 */
export function floorQueue(atoms: AtomState[], now: number, cfg?: DayConfig): FloorItem[] {
  const out: FloorItem[] = [];
  let spent = 0;

  // 1. A due cold gate — the highest-value 2-minute thing there is.
  const gate = dueGates(atoms, now)[0];
  if (gate) {
    out.push({ kind: "gate", atomKey: `${gate.kind}:${gate.ref}`, ref: gate.ref, estMin: 0.9 });
    spent += 0.9;
  }

  // 2. The single riskiest due review that still fits.
  const reviews = atoms
    .filter((a) => a.encoded && a.gatePassed)
    .map((a) => ({ a, risk: forgettingRisk(a, now, cfg) }))
    .filter((r) => r.risk > 0.15)
    .sort((x, y) => y.risk - x.risk);
  for (const r of reviews) {
    if (spent + 0.9 > CAP_MIN) break;
    const key = `${r.a.kind}:${r.a.ref}`;
    if (out.some((i) => i.atomKey === key)) continue;
    out.push({ kind: "review", atomKey: key, ref: r.a.ref, estMin: 0.9 });
    spent += 0.9;
  }

  // 3. Never empty: if nothing due, a warm-up on the strongest carried atom (a
  //    guaranteed win to keep the streak/habit alive).
  if (out.length === 0) {
    const strongest = atoms
      .filter((a) => a.encoded)
      .sort((x, y) => y.strength - x.strength)[0];
    if (strongest) {
      out.push({
        kind: "warmup",
        atomKey: `${strongest.kind}:${strongest.ref}`,
        ref: strongest.ref,
        estMin: 0.8,
      });
    }
  }

  return out;
}

/** Total estimated minutes for a floor queue (always ≤ ~2). */
export function floorMinutes(items: FloorItem[]): number {
  return items.reduce((s, i) => s + i.estMin, 0);
}
