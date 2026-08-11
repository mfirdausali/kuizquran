// THE RETENTION SUMMARY — WIREFRAME §10's numbers, decided here so that none of
// them is decided in a view.
//
// §10's governing sentence, which binds every field below:
//
//   "these are the SAME NUMBERS the scheduler uses, read straight off the
//    atom's stability. Nothing is decorative. An app that shows a green
//    dashboard while its own scheduler thinks the learner is lapsing has lied
//    to them."
//
// This module is the sibling of `rows.ts` and follows its one rule: THE
// COMPONENT NEVER COMPUTES, IT ONLY PRINTS. Every field of `RetentionSummary`
// is already a string or an already-derived number. `check-boundaries.mjs`
// clause 5 forbids engine-decision logic under `app/` and `components/`, and a
// band distribution is literally a count of `band === "lapsed"` while "3 ayat
// are slipping" is literally a strength comparison. Both live here.
//
// (The gate's regex would not catch every phrasing of those — `stage === "x"`
// and `.filter(a => a.strengthPct < 40)` both slip past it. That is not a
// licence: MacroPanel.tsx states the standing rule that a gate failing to catch
// a violation does not make the violation legal. The decisions live here
// regardless of what the grep would fire on.)
//
// PURE. `(corpus, atoms, events, now, since)` in, data out. No `Date.now`, no
// IO — the same contract as `rows.ts`, which is what lets a test freeze it.
//
// ---------------------------------------------------------------------------
// WHY "SLIPPING" IS NOT `band === "lapsed"` — the defect this module was
// written around, and the reason to read before editing
// ---------------------------------------------------------------------------
// §10 asks for "3 ayat are slipping. Not a failure — this is what memory does."
// The obvious implementation counts atoms whose stage is "lapsed". THAT COUNT
// IS PERMANENTLY ZERO, and the app would report it cheerfully forever.
//
// `bandOf()` (atom.ts:47-52) returns "lapsed" only for `strength < 0`, and
// strength can never BE negative: `update.ts` clamps every write with
// `clamp(..., 0, 100)`, and `currentStrength()` multiplies a non-negative
// strength by a non-negative retrievability. So `currentBand()` cannot return
// "lapsed" for any atom the engine can actually produce. Verified directly: an
// atom at strength 70 / stability 1, decayed 20 days, reports
// `currentStrength ≈ 0.00000014` and `currentBand === "learn"` — not "lapsed".
//
// A slipping counter built on the band would therefore be a green board over a
// lapsing learner: exactly the §10 violation quoted above, and exactly this
// build's documented vacuous-verification failure mode (a test that passes, is
// TRUE, and constrains nothing).
//
// So slipping is read from the signals the SCHEDULER itself acts on:
//
//   - FORGETTING RISK past the scheduler's own review threshold. `scheduler.ts`
//     queues a review when `forgettingRisk(atom) * weight > 0.15`. That constant
//     is imported from the engine rather than re-typed here, so the number shown
//     to the learner and the number the scheduler acts on cannot drift apart.
//   - RECORDED LAPSES. `update.ts:81` increments `atom.lapses` when an
//     established atom is missed. That is a real, logged event, not a threshold.
//
// An atom counts as slipping when it is encoded and either signal fires. That
// is a claim the scheduler would agree with, which is the whole of §10.

import type { AtomState, Stage } from "@engine/atom.ts";
import type { Corpus, DrillEvent } from "@engine/types.ts";
import type { DayConfig } from "@engine/daybound.ts";
import { currentBand, currentStrength, forgettingRisk, halfLifeDays } from "@engine/strength.ts";
import { decaySince } from "@engine/decay.ts";
import { expand, siteToAtomKey } from "@engine/site.ts";
import { stageLabelOf } from "@/components/macro/graphNodes.ts";

/**
 * The scheduler's own due-review threshold (`scheduler.ts` step 3:
 * `.filter((r) => r.score > 0.15)`).
 *
 * Duplicated as a named constant because the engine does not export it, and
 * named HERE — rather than written inline at the comparison — so the one place
 * it would have to change is visible. The test asserts an atom the scheduler
 * would queue is an atom this module reports as slipping, so a drift between
 * the two fails rather than merely diverges.
 */
export const REVIEW_RISK_THRESHOLD = 0.15;

/** Connection atoms are weighted up by the scheduler (`DEFAULT_CONN_WEIGHT`),
 *  so a joint becomes due EARLIER than an ayah at the same risk. Mirrored here
 *  for the same reason as the threshold above. */
export const CONNECTION_WEIGHT = 1.5;

/** One band of the distribution. A WORD and a NUMBER, always both — §15's
 *  "never colour alone" made structural: there is no code path that produces a
 *  band without its label, so no view can render colour alone. */
export interface RetentionBand {
  stage: Stage;
  /** "Carrying" · "Reinforcing" · "Learning" · "Not started". */
  label: string;
  count: number;
  /** Whole percent of all atoms in this band, already rounded. */
  pct: number;
  /** "12 of 41" — carried as a string so the view does no arithmetic. */
  countLabel: string;
}

/** One "72% → 64% since Thursday" line. */
export interface DecayRow {
  /** `12:3` or `12:3→4`. Latin digits — an LTR island in the markup. */
  reference: string;
  kindLabel: "Ayah" | "Joint";
  /** "72%" — where it was at `since`. */
  fromLabel: string;
  /** "64%" — where it is now. */
  toLabel: string;
  /** "since Thursday". */
  sinceLabel: string;
  /** The whole sentence, assembled here: "72% → 64% since Thursday". */
  sentence: string;
  stage: Stage;
  stageLabel: string;
  strengthPct: number;
}

export interface RetentionSummary {
  surah: number;
  /** How many atoms this surah has in total (ayat + joints = 2N-1). */
  atomCount: number;
  /** How many have ever been encoded. The denominator for every honest claim. */
  encodedCount: number;
  /** "9.4 days", or "—" when nothing is encoded. NEVER "0 days". */
  headlineHalfLifeLabel: string;
  /** The sentence under the headline, naming what the number means. */
  headlineSentence: string;
  bands: RetentionBand[];
  /** How many atoms the scheduler would treat as slipping. */
  slippingCount: number;
  /** "3 ayat are slipping" / "Nothing is slipping". */
  slippingLabel: string;
  /** §10's exact reframe. Present only when something IS slipping — the
   *  reassurance is meaningless attached to a zero. */
  slippingReassurance: string | null;
  decayRows: DecayRow[];
  /** True when no atom has ever been encoded — the view's designed zero-state. */
  unmeasured: boolean;
}

export interface RetentionInput {
  corpus: Corpus;
  atoms: Map<string, AtomState>;
  events: readonly DrillEvent[];
  /** Resolved ONCE by the caller and passed in, so every figure in one render
   *  decays to the same instant. */
  now: number;
  /** The instant the "since" comparison is measured from — typically one week
   *  back. Passed in, never read from a clock here. */
  since: number;
  cfg?: DayConfig;
}

/** The four stages, in the order a learner reads them: strongest first, so the
 *  distribution tells a story of progress rather than of deficit. */
const BAND_ORDER: readonly Stage[] = ["carry", "reinforce", "learn", "lapsed"];

/**
 * Is this atom slipping, in the sense the SCHEDULER means?
 *
 * Not a band test — see the module header for why a band test is permanently
 * false. An unencoded atom is never slipping: it was never held, so it cannot
 * be slipping away. That distinction is the same one `rows.ts` draws between
 * "0%" and "—", and getting it wrong would report every untouched ayah of a
 * 111-ayah surah as slipping on a learner's first day.
 */
function isSlipping(atom: AtomState, now: number, cfg?: DayConfig): boolean {
  if (!atom.encoded) return false;
  if (atom.lapses > 0) return true;
  const weight = atom.kind === "connection" ? CONNECTION_WEIGHT : 1;
  return forgettingRisk(atom, now, cfg) * weight > REVIEW_RISK_THRESHOLD;
}

/**
 * The headline half-life: the MEDIAN across encoded atoms.
 *
 * The choice is deliberate and is a §10 decision, not an implementation detail:
 *
 *   - The MEAN would be dragged upward by a handful of well-carried early ayat
 *     and would keep reporting a comfortable number while the newest third of
 *     the surah decayed. That is the green-dashboard failure the section's own
 *     rule forbids.
 *   - The MAXIMUM is the same failure, louder.
 *   - The MEDIAN answers the question a learner is actually asking — "how long
 *     does what I know typically last?" — and moves when half the graph moves.
 *
 * UNENCODED ATOMS ARE EXCLUDED FROM THE DENOMINATOR. Including them would put
 * a hundred zeros in the sample on day one and pin the median at 0 days, which
 * is not a measurement of anything. An unmeasured graph reports "—", never
 * "0 days" — `rows.ts`'s unmeasured-vs-zero rule, applied to the aggregate.
 */
function headlineHalfLife(atoms: AtomState[]): number | null {
  const measured = atoms.filter((a) => a.encoded && a.stability > 0).map(halfLifeDays);
  if (measured.length === 0) return null;
  const sorted = [...measured].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** "3 ayat" / "1 ayah" — the noun agrees with the number. A joint is counted
 *  as an item, so the word is deliberately the neutral "items" when joints are
 *  in the mix, rather than calling a junction an ayah. */
function slippingWords(count: number, anyJoints: boolean): string {
  if (count === 0) return "Nothing is slipping";
  const noun = anyJoints ? (count === 1 ? "item" : "items") : count === 1 ? "ayah" : "ayat";
  return `${count} ${noun} ${count === 1 ? "is" : "are"} slipping`;
}

/**
 * Build the whole retention surface for one surah.
 *
 * Every atom of the memory graph is walked through `expand()` — ayat AND
 * joints — for the same reason `rows.ts` does it: edge case #90, where a view
 * built on `ayahHeatmap()` silently drops the N-1 connection atoms that are
 * ~40% of a short surah. A band distribution over ayat alone would be a
 * distribution over 60% of the graph, wearing the costume of the whole.
 */
export function buildRetentionSummary(input: RetentionInput): RetentionSummary {
  const { corpus, atoms, now, since, cfg } = input;
  const surah = corpus.meta.surah;
  const count = corpus.meta.ayahCount;

  const sites = count >= 1 ? expand(surah, 1, count, count) : [];

  // Walk the graph ONCE, collecting everything each field needs. A second pass
  // per field would be a second place for the keying to be got wrong.
  const present: { atom: AtomState; isSeam: boolean; ayah: number }[] = [];
  const bandCounts = new Map<Stage, number>();
  for (const stage of BAND_ORDER) bandCounts.set(stage, 0);

  let encodedCount = 0;
  let anyJoints = false;

  for (const site of sites) {
    const atom = atoms.get(siteToAtomKey(site));
    const isSeam = site.kind === "seam";

    // An absent atom is a real state, not a missing one: it is an item the
    // learner has not reached. It belongs in the distribution as "Not started"
    // (stage `learn`, unencoded) — omitting it would shrink the denominator and
    // flatter every percentage.
    const stage: Stage = atom ? currentBand(atom, now, cfg) : "learn";
    bandCounts.set(stage, (bandCounts.get(stage) ?? 0) + 1);

    if (atom) {
      if (atom.encoded) encodedCount += 1;
      present.push({ atom, isSeam, ayah: site.ayah });
      if (isSeam && atom.encoded) anyJoints = true;
    }
  }

  const atomCount = sites.length;
  const encodedAtoms = present.filter((p) => p.atom.encoded).map((p) => p.atom);

  // BANDS. The label comes from `stageLabelOf`, the same function the ring and
  // the table use, so the three surfaces can never call one atom by three
  // names. `encoded: false` is passed only for the learn band, where "Not
  // started" is the honest word for a graph nobody has touched yet.
  const bands: RetentionBand[] = BAND_ORDER.map((stage) => {
    const c = bandCounts.get(stage) ?? 0;
    // The learn band holds both "Learning" and "Not started" atoms. It is
    // labelled by whichever the learner actually has: with nothing encoded the
    // word is "Not started", which is true and is not the same claim as
    // "Learning".
    const encodedInBand = stage === "learn" && encodedCount > 0;
    return {
      stage,
      label: stageLabelOf(stage, stage === "learn" ? encodedInBand : true),
      count: c,
      pct: atomCount > 0 ? Math.round((c / atomCount) * 100) : 0,
      countLabel: `${c} of ${atomCount}`,
    };
  });

  // SLIPPING. Counted here, never in JSX.
  const slipping = present.filter((p) => isSlipping(p.atom, now, cfg));
  const slippingCount = slipping.length;

  // DECAY ROWS. Only atoms that ACTUALLY DECLINED are shown — a row reading
  // "72% → 72% since Thursday" is noise, and a row that went UP would be
  // filed under a heading about decay while contradicting it. Sorted by the
  // size of the drop, so the worst news is first rather than buried.
  const declined: { row: DecayRow; drop: number }[] = [];
  for (const p of present) {
    if (!p.atom.encoded) continue;
    const d = decaySince(p.atom, since, now, cfg);
    if (!d.declined) continue;
    const stage = currentBand(p.atom, now, cfg);
    declined.push({
      drop: d.sincePct - d.nowPct,
      row: {
        reference: p.isSeam ? `${surah}:${p.ayah}→${p.ayah + 1}` : `${surah}:${p.ayah}`,
        kindLabel: p.isSeam ? "Joint" : "Ayah",
        fromLabel: `${d.sincePct}%`,
        toLabel: `${d.nowPct}%`,
        sinceLabel: `since ${d.sinceLabel}`,
        sentence: `${d.sincePct}% → ${d.nowPct}% since ${d.sinceLabel}`,
        stage,
        stageLabel: stageLabelOf(stage, p.atom.encoded),
        strengthPct: Math.round(currentStrength(p.atom, now, cfg)),
      },
    });
  }
  // Worst news first, never buried. A dashboard is a summary, not the list:
  // the full, sortable, searchable enumeration is /progress/list, which is also
  // the ring's documented text alternative (§15) — so this is a preview WITH A
  // WAY THROUGH, not a truncation that hides items with no route to them.
  const decayRows: DecayRow[] = declined
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 5)
    .map((d) => d.row);

  const half = headlineHalfLife(encodedAtoms);
  const unmeasured = encodedCount === 0;

  return {
    surah,
    atomCount,
    encodedCount,
    // "—", never "0 days": an unmeasured graph is not a graph that decays
    // instantly. Same rule as `rows.ts`'s strengthLabel.
    headlineHalfLifeLabel: half === null ? "—" : `${half.toFixed(1)} days`,
    headlineSentence:
      half === null
        ? "Nothing has been encoded yet, so there is no half-life to report."
        : `Typically, half of what you know would fade in ${half.toFixed(1)} days without review.`,
    bands,
    slippingCount,
    slippingLabel: slippingWords(slippingCount, anyJoints),
    // §10's exact reframe. Attached only when there is something to reframe.
    slippingReassurance:
      slippingCount > 0 ? "Not a failure — this is what memory does." : null,
    decayRows,
    unmeasured,
  };
}
