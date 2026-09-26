// Scheduler (FR3). assembleQueue orders a session in the exact FR3 sequence:
//   make-up merge → gates → due reviews (ranked by forgetting-risk × weight,
//   connections weighted up) → fit to time budget → interleave Learn cycles.
// New-ayah unlock is gated by the mastery gate (unlockPermitted). Pure.

import { atomKey, type AtomState } from "./atom.ts";
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
  /** v3-D256 (FR5 "makeup", edge case #70) — how many make-up items ONE
   *  session's queue may carry, overriding `MAKEUP_CAP`. Exposed for tests;
   *  no production caller has a reason to pass anything but the default. */
  makeupCap?: number;
}

// Appendix A cost constants: T ≈ 0.33·W_new + 0.4·R_due + 1.25·chains + 0.17·junctions.
const COST_LEARN = 0.33; // per new word — but at the ayah level we estimate per ayah below
const COST_REVIEW = 0.4;
const COST_GATE = 0.4;
const COST_MAKEUP = 0.4;
const DEFAULT_BUDGET = 8;
const DEFAULT_CONN_WEIGHT = 1.5;

/**
 * v3-D256 — FR5 "makeup" / edge case #70 ("Churned learner returns after
 * months... queue explosion; makeup caps queue + says what deferred") and
 * #98 ("Returning after weeks... makeup messaging says what was deferred",
 * `docs/WIREFRAME.md`'s own "Returning after weeks" row: `resumePolicy()` →
 * `makeup`. "Cap the queue, say what was deferred, keep the session
 * finishable.").
 *
 * Before this constant existed, step 1 below folded EVERY gate that came due
 * on a skipped learning-day into `mandatory` items — the ones the time-budget
 * fit (step 4) may NEVER drop, by FR3's own "the session must remain
 * finishable" rule. A learner who skipped three weeks could therefore be
 * handed a dozen-plus mandatory gates in a single sitting: the literal "queue
 * explosion" #70 names, and the exact promise
 * `apps/web/components/home/MySurahs.tsx`'s own #98 copy already made
 * ("Your next sessions will work through the backlog a piece at a time
 * instead of handing you all of it at once") without the engine ever having
 * built the cap that sentence describes.
 *
 * A session absorbs at most this many make-up items; the rest are DEFERRED to
 * a later session — their own `gateDueAt` is untouched (this is a QUEUE
 * decision, never a re-scheduling one), so they are picked up again,
 * oldest-missed-first, once today's cap is spent. `makeupDeferredCount`
 * (below) is how a caller may honestly report how many that is.
 */
export const MAKEUP_CAP = 3;

/**
 * The gates due on a SKIPPED learning-day (the same predicate step 1 below
 * uses), oldest-missed-first. Both `assembleQueue`'s own make-up step and
 * `makeupDeferredCount` read this ONE list — the same "one decision, one
 * function" discipline `gateStateOf` (v3-D211/D212) already established for
 * this codebase — so the queue and the honest "N deferred" count can never
 * disagree about which atoms qualify.
 */
function missedDayGates(
  atoms: AtomState[],
  now: number,
  lastActiveDay: number | null,
): AtomState[] {
  if (lastActiveDay === null) return [];
  return atoms
    .filter(
      (a) =>
        a.gateDueAt !== null &&
        !a.gatePassed &&
        a.gateDueAt <= now &&
        // came due strictly after the last active day (i.e. on a skipped day)
        a.gateDueAt > lastActiveDay,
    )
    .sort((a, b) => a.gateDueAt! - b.gateDueAt!);
}

/**
 * How many make-up items a real assembly for this surah would defer past the
 * cap — `0` for an ordinary next-day return (not a skipped-day gap) or when
 * nothing exceeds it. Computed off the identical candidate list
 * `assembleQueue`'s own make-up step reads (`missedDayGates`, above), so this
 * can never disagree with what a session's own queue actually carries.
 *
 * Defensively scoped to `surah` (DEFECTS.md#E-02's own discipline): a caller
 * that hands atoms from more than one surah can never have another surah's
 * backlog counted here.
 */
export function makeupDeferredCount(
  atoms: AtomState[],
  surah: number,
  now: number,
  lastActiveDay: number | null,
  cfg?: { day?: DayConfig; cap?: number },
): number {
  if (lastActiveDay === null) return 0;
  if (daysBetween(lastActiveDay, now, cfg?.day) < 2) return 0;
  const scoped = atoms.filter((a) => a.surah === surah);
  const candidates = missedDayGates(scoped, now, lastActiveDay);
  const cap = cfg?.cap ?? MAKEUP_CAP;
  return Math.max(0, candidates.length - cap);
}

/** Estimate minutes to Learn one ayah (Appendix A: ~0.33 min/word). */
export function estLearnMinutes(wordCount: number): number {
  return COST_LEARN * wordCount;
}

export interface AssembleInput {
  /** DEFECTS.md#E-01: the surah this queue is assembled for. Every emitted
   *  QueueItem.atomKey is scoped to this surah — atoms from a different
   *  surah are never mixed into one queue at this step (E-02's multi-surah
   *  budget/merge logic is build-plan step 9, not this one). */
  surah: number;
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
  const { now, surah } = input;
  // DEFECTS.md#E-02 (build-plan step 9): "one atoms array, N decay curves"
  // — defensively scope to THIS surah's atoms only, so a caller that (by
  // accident or by a future multi-surah caller's design) passes atoms from
  // more than one surah can never have them mixed into one queue/budget.
  const atoms = input.atoms.filter((a) => a.surah === surah);
  const cfg = input.cfg ?? {};
  const dayCfg = cfg.day;
  const budget = cfg.budgetMin ?? DEFAULT_BUDGET;
  const connWeight = cfg.connectionWeight ?? DEFAULT_CONN_WEIGHT;

  const queue: QueueItem[] = [];

  // 1. MAKE-UP MERGE — only if the user SKIPPED one or more learning-days (a gap
  //    of ≥2 learning-days since last active). A normal next-day return is NOT a
  //    make-up; those gates flow through step 2 as ordinary cold gates. A make-up
  //    item is one that came due on a day that was skipped entirely.
  //
  //    v3-D256: capped at `MAKEUP_CAP` (or `cfg.makeupCap`), oldest-missed-first
  //    — see `missedDayGates`/`makeupDeferredCount`, above, for why. The rest
  //    are deferred to a later session, not dropped from the schedule: their
  //    own `gateDueAt` is untouched, so they simply reappear here once the cap
  //    is spent.
  const missedDays =
    input.lastActiveDay !== null && daysBetween(input.lastActiveDay, now, dayCfg) >= 2;
  if (missedDays) {
    const cap = cfg.makeupCap ?? MAKEUP_CAP;
    for (const a of missedDayGates(atoms, now, input.lastActiveDay).slice(0, cap)) {
      queue.push({ kind: "makeup", atomKey: atomKey(a.surah, a.kind, a.ref), ayah: a.ref, estMin: COST_MAKEUP });
    }
  }

  // 2. GATES — day-1 cold gates due now (that weren't already pulled as make-ups).
  const alreadyQueued = new Set(queue.map((q) => q.atomKey));
  for (const a of dueGates(atoms, now)) {
    const key = atomKey(a.surah, a.kind, a.ref);
    if (!alreadyQueued.has(key)) {
      queue.push({ kind: "gate", atomKey: key, ayah: a.ref, estMin: COST_GATE });
      alreadyQueued.add(key);
    }
  }

  // 3. DUE REVIEWS — encoded, gate-passed atoms, ranked by forgetting-risk ×
  //    weight (connection atoms weighted up).
  const reviews = atoms
    .filter((a) => a.encoded && a.gatePassed && !alreadyQueued.has(atomKey(a.surah, a.kind, a.ref)))
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
      atomKey: atomKey(r.a.surah, r.a.kind, r.a.ref),
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
  if (unlockPermitted(atoms, now, surah, cfg.gateTolerance ?? 0)) {
    const encodedOrQueued = new Set(atoms.filter((a) => a.encoded).map((a) => a.ref));
    for (const ayah of cfg.learnCandidates ?? []) {
      if (encodedOrQueued.has(ayah)) continue;
      const est = estLearnMinutes(input.wordCounts.get(ayah) ?? 12);
      if (spent + est > budget) break;
      fitted.push({ kind: "learn", atomKey: atomKey(surah, "ayah", ayah), ayah, estMin: est });
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
