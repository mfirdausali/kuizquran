// Scheduler (FR3). assembleQueue orders a session in the exact FR3 sequence:
//   make-up merge → gates → due reviews (ranked by forgetting-risk × weight,
//   connections weighted up) → fit to time budget → interleave Learn cycles.
// New-ayah unlock is gated by the mastery gate (unlockPermitted). Pure.

import type { AtomState } from "./atom.ts";
import { forgettingRisk } from "./strength.ts";
import { dueGates, unlockPermitted } from "./gate.ts";
import { daysBetween, type DayConfig } from "./daybound.ts";

export type QueueItemKind = "makeup" | "gate" | "review" | "learn";

export interface QueueItem {
  kind: QueueItemKind;
  atomKey: string;
  ayah: number;
  /** Estimated minutes this item costs (for the time budget). */
  estMin: number;
  /** Ranking score (higher = more urgent); undefined for learn/makeup ordering. */
  score?: number;
}

export interface ScheduleConfig {
  day?: DayConfig;
  /** Session time cap in minutes (PRD FR3: ~6–8 min default). */
  budgetMin?: number;
  /** Connection atoms get their forgetting-risk multiplied by this (weighted up). */
  connectionWeight?: number;
  /** Ayah numbers eligible to be newly Learned this session, in priority order. */
  learnCandidates?: number[];
  /** v2-D07 unlock tolerance: pending cold gates still tolerated before blocking
   *  new Learn (mode-scoped via pace.ts's PaceConfig.gateTolerance). Default 0. */
  gateTolerance?: number;
}

// Appendix A cost constants: T ≈ 0.33·W_new + 0.4·R_due + 1.25·chains + 0.17·junctions.
const COST_LEARN = 0.33; // per new word — but at the ayah level we estimate per ayah below
const COST_REVIEW = 0.4;
const COST_GATE = 0.4;
const COST_MAKEUP = 0.4;
const DEFAULT_BUDGET = 8;
const DEFAULT_CONN_WEIGHT = 1.5;

/** Estimate minutes to Learn one ayah (Appendix A: ~0.33 min/word). */
export function estLearnMinutes(wordCount: number): number {
  return COST_LEARN * wordCount;
}

export interface AssembleInput {
  atoms: AtomState[];
  now: number;
  /** ms of the last learning-day the user had a session, or null if none. */
  lastActiveDay: number | null;
  /** word count per ayah, for Learn-cost estimation. */
  wordCounts: Map<number, number>;
  cfg?: ScheduleConfig;
}

/**
 * Assemble the session queue. Order is fixed by FR3; items are dropped once the
 * time budget is exhausted, EXCEPT the session is always finishable (gates +
 * make-ups are never dropped — they define the minimum viable session).
 */
export function assembleQueue(input: AssembleInput): QueueItem[] {
  const { atoms, now } = input;
  const cfg = input.cfg ?? {};
  const dayCfg = cfg.day;
  const budget = cfg.budgetMin ?? DEFAULT_BUDGET;
  const connWeight = cfg.connectionWeight ?? DEFAULT_CONN_WEIGHT;

  const queue: QueueItem[] = [];

  // 1. MAKE-UP MERGE — only if the user SKIPPED one or more learning-days (a gap
  //    of ≥2 learning-days since last active). A normal next-day return is NOT a
  //    make-up; those gates flow through step 2 as ordinary cold gates. A make-up
  //    item is one that came due on a day that was skipped entirely.
  const missedDays =
    input.lastActiveDay !== null && daysBetween(input.lastActiveDay, now, dayCfg) >= 2;
  if (missedDays) {
    // The learning-day the user was last active + 1 is the first skipped day.
    for (const a of atoms) {
      if (
        a.gateDueAt !== null &&
        !a.gatePassed &&
        a.gateDueAt <= now &&
        // came due strictly after the last active day (i.e. on a skipped day)
        a.gateDueAt > input.lastActiveDay!
      ) {
        queue.push({ kind: "makeup", atomKey: `${a.kind}:${a.ref}`, ayah: a.ref, estMin: COST_MAKEUP });
      }
    }
  }

  // 2. GATES — day-1 cold gates due now (that weren't already pulled as make-ups).
  const alreadyQueued = new Set(queue.map((q) => q.atomKey));
  for (const a of dueGates(atoms, now)) {
    const key = `${a.kind}:${a.ref}`;
    if (!alreadyQueued.has(key)) {
      queue.push({ kind: "gate", atomKey: key, ayah: a.ref, estMin: COST_GATE });
      alreadyQueued.add(key);
    }
  }

  // 3. DUE REVIEWS — encoded, gate-passed atoms, ranked by forgetting-risk ×
  //    weight (connection atoms weighted up).
  const reviews = atoms
    .filter((a) => a.encoded && a.gatePassed && !alreadyQueued.has(`${a.kind}:${a.ref}`))
    .map((a) => {
      const risk = forgettingRisk(a, now, dayCfg);
      const weight = a.kind === "connection" ? connWeight : 1;
      return { a, score: risk * weight };
    })
    // Only actually-due-ish items (some decay has happened).
    .filter((r) => r.score > 0.15)
    .sort((x, y) => y.score - x.score);
  for (const r of reviews) {
    queue.push({
      kind: "review",
      atomKey: `${r.a.kind}:${r.a.ref}`,
      ayah: r.a.ref,
      estMin: COST_REVIEW,
      score: r.score,
    });
  }

  // 4. FIT TO TIME BUDGET — drop trailing reviews that overflow, but never drop
  //    gates or make-ups (the session must remain finishable & honor mastery).
  const mandatory = queue.filter((q) => q.kind === "gate" || q.kind === "makeup");
  const optional = queue.filter((q) => q.kind === "review");
  let spent = mandatory.reduce((s, q) => s + q.estMin, 0);
  const fitted: QueueItem[] = [...mandatory];
  for (const q of optional) {
    if (spent + q.estMin > budget) break;
    fitted.push(q);
    spent += q.estMin;
  }

  // 5. INTERLEAVE LEARN — only if the mastery gate permits new unlocks (within
  //    the mode-scoped tolerance band, v2-D07) AND budget remains. Learn cycles
  //    are interleaved between review items.
  if (unlockPermitted(atoms, now, cfg.gateTolerance ?? 0)) {
    const encodedOrQueued = new Set(atoms.filter((a) => a.encoded).map((a) => a.ref));
    for (const ayah of cfg.learnCandidates ?? []) {
      if (encodedOrQueued.has(ayah)) continue;
      const est = estLearnMinutes(input.wordCounts.get(ayah) ?? 12);
      if (spent + est > budget) break;
      fitted.push({ kind: "learn", atomKey: `ayah:${ayah}`, ayah, estMin: est });
      spent += est;
    }
  }

  return interleaveLearn(fitted);
}

/** Interleave Learn items between review items (FR3: "Learn cycles interleaved"). */
function interleaveLearn(items: QueueItem[]): QueueItem[] {
  const gatesMakeups = items.filter((q) => q.kind === "gate" || q.kind === "makeup");
  const reviews = items.filter((q) => q.kind === "review");
  const learns = items.filter((q) => q.kind === "learn");
  // Gates/make-ups first (mastery + recovery), then reviews with learns woven in.
  const woven: QueueItem[] = [...gatesMakeups];
  let li = 0;
  for (let i = 0; i < reviews.length; i++) {
    woven.push(reviews[i]!);
    if (li < learns.length && (i + 1) % 2 === 0) woven.push(learns[li++]!);
  }
  while (li < learns.length) woven.push(learns[li++]!);
  return woven;
}
