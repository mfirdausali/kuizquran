// THE PROGRESS ROW BUILDER — where every decision about the progress table is
// made, so that none of them is made in a view.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE IS IN lib/ AND NOT IN components/
// ---------------------------------------------------------------------------
// `check-boundaries.mjs` clause 5 forbids engine-decision logic under `app/`
// and `components/`: rungs, bands and schedules are decided in the engine and
// must ARRIVE AS DATA. That is what makes DEFECTS.md#B2 impossible by
// construction rather than merely fixed once.
//
// A band comparison is the obvious case. The less obvious ones are the reason
// this module exists at all: choosing a stage's WORD, deciding whether a seam
// is eligible, deciding whether "0%" or "—" is the honest thing to print. Each
// of those is a decision, and a decision in a view is a decision that will
// eventually disagree with the engine's own. So the view receives a
// `ProgressRow` in which every cell is already a STRING or an already-derived
// number, and the table's only remaining job is to put them in <td>s.
//
// The rule the whole file follows: THE COMPONENT NEVER COMPUTES, IT ONLY
// PRINTS. If a component would have to ask a question to render a cell, the
// answer belongs here.
//
// ---------------------------------------------------------------------------
// WHERE THE TWO HALVES OF THE MEMORY GRAPH COME FROM
// ---------------------------------------------------------------------------
// Edge case #90: "connection atoms invisible (40% of Al-Asr's atoms) — half
// the memory graph unrendered." The obvious implementation reaches for
// `ayahHeatmap()`, which is ayah-only (heatmap.ts:21) — and that IS the bug,
// arrived at honestly.
//
// So rows are built from `expand()` instead. `expand()` is the engine's own
// packaging function and it emits the alternating sequence
//
//     ayah 1, seam 1, ayah 2, seam 2, ..., ayah N
//
// in which a seam is a PEER of an ayah, not an annotation hanging off one.
// Two consequences fall out for free:
//
//   - the seam count is N-1 by construction, so "seams are rendered" is not
//     something anyone has to remember to do;
//   - `expand()` never constructs a seam at the last ayah, which is
//     DEFECTS.md#E-08's by-construction fix. There is no bound check here
//     because there is nothing to bound.
//
// A seam's strength is read through `siteToAtomKey()` — never a hand-built
// template literal. atom.ts:73-78 is explicit about why: a raw
// `` `${kind}:${ref}` `` is "a lookup miss, not a type error", so a seam that
// silently mirrored its left-hand ayah would be invisible in a screenshot and
// wrong in the data.

import type { AtomState, Stage } from "@engine/atom.ts";
import type { Corpus, DrillEvent } from "@engine/types.ts";
import { atomKey } from "@engine/atom.ts";
import { currentBand, currentStrength, halfLifeDays } from "@engine/strength.ts";
import { expand, siteToAtomKey, type Site } from "@engine/site.ts";
import { resumePolicy } from "@engine/resume.ts";

/** What kind of memory atom a row stands for. A WORD, not a glyph: edge case
 *  #90's fix in the table is that a joint is distinguishable from an ayah
 *  after the table is sorted by strength and the rows interleave, at which
 *  point the arrow inside the reference is no help at all. */
export type RowKind = "ayah" | "seam";

/** The gate's state for this atom — edge case #101 ("gate-pending lock
 *  opacity → learner confusion"). Opacity is not a state; these are. */
export type GateState = "none" | "armed" | "due" | "passed" | "failed";

/**
 * One rendered row. EVERY FIELD IS ALREADY A DECISION MADE — the component
 * that consumes this does no arithmetic, no comparison and no lookup.
 *
 * In particular `stageLabel` is a STRING carried in the data rather than a
 * lookup table living in the component. That is what makes edge case #87
 * ("never colour alone") structurally impossible instead of merely observed:
 * there is no code path that produces a row without its word, so there is no
 * code path that can render colour alone.
 */
export interface ProgressRow {
  /** Stable React key and test handle. `12:ayah:3` / `12:seam:3`. */
  id: string;
  kind: RowKind;
  surah: number;
  /** For an ayah: its number. For a seam: the `from` ayah of the n→n+1 junction. */
  ayah: number;
  /** `12:3` or `12:3→4`. Latin digits — always an LTR island in the markup. */
  reference: string;
  /** The word for this row's kind. Never inferred from the reference glyph. */
  kindLabel: "Ayah" | "Joint";
  /** Corpus text. For a seam, the tail of `from` and the head of `to`, joined
   *  by a visible separator — the seam's memory content IS the transition. */
  text: string;
  stage: Stage;
  /** "Not started" · "Learning" · "Reinforcing" · "Carrying" · "Lapsed". */
  stageLabel: string;
  /** 0–100, already decayed to `now` and already rounded. */
  strengthPct: number;
  /** "48%" — or "—" when the atom has never been encoded. A never-touched
   *  atom is not "0% strong", it is UNMEASURED, and printing 0 for it is the
   *  same class of dishonesty as edge case #73's zeros-while-pending. */
  strengthLabel: string;
  /** "9.4 days", or "—" at stability 0. */
  halfLifeLabel: string;
  /** "Today" · "in 3 days" · "Gate due today" (#101). */
  nextLabel: string;
  gate: GateState;
  /** "2m 14s", or "—". TIME ON TASK — see `timeOnTaskMs`. */
  timeOnTask: string;
}

/** The five stage words. Five, not four: "Not started" is `learn` with
 *  `encoded: false`, a state `heatmap.ts:31` already distinguishes and which a
 *  learner experiences as genuinely different from "learning". */
function stageWord(stage: Stage, encoded: boolean): string {
  switch (stage) {
    case "learn":
      return encoded ? "Learning" : "Not started";
    case "reinforce":
      return "Reinforcing";
    case "carry":
      return "Carrying";
    case "lapsed":
      return "Lapsed";
  }
}

/** The gate's state as a value rather than as an opacity (#101). */
function gateStateOf(atom: AtomState | undefined, now: number): GateState {
  if (!atom || atom.gateDueAt === null) return atom?.gatePassed ? "passed" : "none";
  if (atom.gatePassed) return "passed";
  if (atom.gateFails > 0) return "failed";
  return atom.gateDueAt <= now ? "due" : "armed";
}

/** Whole days from `now` to `at`, rounded up — 0 meaning "today". */
function daysUntil(at: number, now: number): number {
  return Math.max(0, Math.ceil((at - now) / 86_400_000));
}

function nextWord(atom: AtomState | undefined, gate: GateState, now: number): string {
  if (gate === "due") return "Gate due today";
  if (gate === "armed" && atom?.gateDueAt != null) {
    const d = daysUntil(atom.gateDueAt, now);
    return d === 0 ? "Gate due today" : `Gate in ${d} day${d === 1 ? "" : "s"}`;
  }
  if (!atom || atom.lastRetrieval === null || atom.stability <= 0) return "Not scheduled";
  // Due when retrievability crosses the half-life — the same curve the
  // scheduler reads, so the date shown is the date used (§10).
  const dueAt = atom.lastRetrieval + halfLifeDays(atom) * 86_400_000;
  const d = daysUntil(dueAt, now);
  if (d === 0) return "Today";
  return `in ${d} day${d === 1 ? "" : "s"}`;
}

/** A duration a human reads. "2m 14s" / "48s". Never a bare millisecond count. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min === 0 ? `${sec}s` : `${min}m ${sec}s`;
}

/**
 * TIME ON TASK for one atom — the sum of the latencies actually MEASURED on
 * it, never `last.ts − first.ts`.
 *
 * §15, verbatim: "interrupted latencies are discarded by design (resume.ts),
 * so time-taken must be reported as TIME ON TASK, never wall-clock —
 * otherwise a learner who took a phone call looks slower than they were."
 *
 * The discard rule is not re-implemented here; `resumePolicy()` is asked. An
 * event whose gap from the previous one classifies as anything other than
 * "resume" had its item interrupted, and `resumePolicy` says so via
 * `discardLatency` — the same function the session loop uses, so the number in
 * this column is the number the engine believes.
 */
export function timeOnTaskMs(
  events: DrillEvent[],
  surah: number,
  kind: "ayah" | "connection",
  ref: number,
): number {
  // Which events grade THIS atom. A connection atom is credited by junction
  // and chain-junction events, whose `ayah` field holds the `from` of n→n+1.
  const mine = events.filter((e) => {
    if (e.surah !== surah) return false;
    if (typeof e.latency !== "number") return false;
    if (kind === "connection") {
      return (
        e.ayah === ref &&
        (e.type === "junction_result" ||
          (e.type === "chain_step" && e.stepKind === "junction") ||
          e.type === "connection_born")
      );
    }
    return e.ayah === ref && e.type !== "junction_result" && e.stepKind !== "junction";
  });

  let total = 0;
  let previousTs: number | null = null;
  for (const e of mine) {
    // The FIRST measured item on an atom has no preceding activity to be
    // interrupted from, so it always counts.
    const interrupted =
      previousTs !== null && resumePolicy(previousTs, e.ts).discardLatency;
    if (!interrupted) total += e.latency ?? 0;
    previousTs = e.ts;
  }
  return total;
}

/** The last word of a verse and the first word of the next — the two halves a
 *  junction actually joins. Corpus data at runtime; not one glyph is authored
 *  in this repo (check-boundaries.mjs clause 4). */
function seamText(corpus: Corpus, from: number, to: number): string {
  const tail = corpus.verses.find((v) => v.ayah === from)?.text_uthmani.split(/\s+/).slice(-2).join(" ") ?? "";
  const head = corpus.verses.find((v) => v.ayah === to)?.text_uthmani.split(/\s+/).slice(0, 2).join(" ") ?? "";
  // A visible separator, so the cell reads as a TRANSITION rather than as one
  // continuous fragment the learner is asked to produce.
  return `${tail} · ${head}`;
}

function ayahText(corpus: Corpus, ayah: number): string {
  const full = corpus.verses.find((v) => v.ayah === ayah)?.text_uthmani ?? "";
  // An incipit, not the whole verse: this is a scannable index, and a table
  // cell holding a 40-word ayah stops being scannable.
  const words = full.split(/\s+/);
  return words.length <= 6 ? full : `${words.slice(0, 6).join(" ")}…`;
}

export interface BuildRowsInput {
  corpus: Corpus;
  atoms: Map<string, AtomState>;
  events: DrillEvent[];
  now: number;
}

/**
 * Build every row for one surah, in `expand()` order — ayah 1, seam 1→2,
 * ayah 2, … — so the DEFAULT view of the table IS the memory graph in reading
 * order and the seams are visible before anyone touches a sort control.
 */
export function buildProgressRows(input: BuildRowsInput): ProgressRow[] {
  const { corpus, atoms, events, now } = input;
  const surah = corpus.meta.surah;
  const count = corpus.meta.ayahCount;
  if (count < 1) return [];

  const sites: Site[] = expand(surah, 1, count, count);

  return sites.map((site) => {
    const key = siteToAtomKey(site);
    const atom = atoms.get(key);
    const isSeam = site.kind === "seam";

    // Every band/strength value comes from the engine's own functions, already
    // decayed to `now`. Nothing here compares a strength to a threshold.
    const strength = atom ? Math.round(currentStrength(atom, now)) : 0;
    const stage: Stage = atom ? currentBand(atom, now) : "learn";
    const encoded = atom?.encoded ?? false;
    const gate = gateStateOf(atom, now);

    const ms = timeOnTaskMs(events, surah, isSeam ? "connection" : "ayah", site.ayah);
    const halfLife = atom ? halfLifeDays(atom) : 0;

    return {
      id: `${surah}:${site.kind}:${site.ayah}`,
      kind: site.kind,
      surah,
      ayah: site.ayah,
      reference: isSeam ? `${surah}:${site.ayah}→${site.ayah + 1}` : `${surah}:${site.ayah}`,
      kindLabel: isSeam ? "Joint" : "Ayah",
      text: isSeam ? seamText(corpus, site.ayah, site.ayah + 1) : ayahText(corpus, site.ayah),
      stage,
      stageLabel: stageWord(stage, encoded),
      strengthPct: strength,
      // Unmeasured is "—", not "0%". See the field's own doc above.
      strengthLabel: encoded || strength > 0 ? `${strength}%` : "—",
      halfLifeLabel: halfLife > 0 ? `${halfLife.toFixed(1)} days` : "—",
      nextLabel: nextWord(atom, gate, now),
      gate,
      timeOnTask: formatDuration(ms),
      // `atomKey` is referenced so the module's dependence on the E-01 keying
      // is explicit rather than implied by siteToAtomKey's internals.
    } satisfies ProgressRow;
  });
}

/** Exported for the surah page's own use: the same keying, one atom at a time. */
export function rowAtomKey(surah: number, kind: RowKind, ref: number): string {
  return atomKey(surah, kind === "seam" ? "connection" : "ayah", ref);
}

/**
 * THE ONE ROW for one ayah — the ayah detail route's "how well you hold it".
 *
 * WHY THIS IS HERE AND NOT A `.find()` IN THE ISLAND. The id format
 * (`${surah}:${kind}:${ayah}`) is this module's own invention, written in
 * exactly one place above. An island reaching in with a hand-built template
 * literal would be a second copy of that format — and atom.ts already says what
 * a hand-built key costs: "a lookup miss, not a type error". The row would come
 * back `undefined`, the island would render its empty state, and the learner
 * would be told "Not started" for an ayah they have carried for weeks. Silent,
 * plausible, and wrong: the same shape as every defect in DEFECTS.md.
 *
 * Returns `undefined` for an ayah outside the surah — the caller renders a
 * designed state, never a fabricated zero.
 */
export function ayahRow(rows: readonly ProgressRow[], ayah: number): ProgressRow | undefined {
  return rows.find((r) => r.kind === "ayah" && r.ayah === ayah);
}

/** The SEAM leaving this ayah — `ayah → ayah+1`, or `undefined` at the last
 *  ayah, where `expand()` never constructs one (E-08, by construction).
 *
 *  Edge case #90 at the single-ayah zoom: an ayah detail page that reported
 *  only the ayah's own strength would tell a learner they hold 12:4 at 90%
 *  while the joint out of it sits at 0% — which is exactly the "you know 3, you
 *  know 4, you cannot go 3→4" failure v3-D03 exists to model. The joint is the
 *  half of the graph a per-ayah view is most likely to drop. */
export function seamRowFrom(rows: readonly ProgressRow[], ayah: number): ProgressRow | undefined {
  return rows.find((r) => r.kind === "seam" && r.ayah === ayah);
}

// ---------------------------------------------------------------------------
// SORTING AND SEARCHING — also decisions, also not in the view
// ---------------------------------------------------------------------------

export type SortColumn =
  | "reference"
  | "text"
  | "kind"
  | "stage"
  | "strength"
  | "halfLife"
  | "next"
  | "time";

export type SortDirection = "ascending" | "descending";

/** Band order for sorting by stage — weakest first is the highest-value view
 *  in the product, so the order is explicit rather than alphabetical. */
const STAGE_ORDER: Record<Stage, number> = { lapsed: 0, learn: 1, reinforce: 2, carry: 3 };

/**
 * Sort rows. `reference` ascending is `expand()` order — NOT numeric order on
 * the ayah field, which would put ayah 2 before seam 1→2 and quietly reorder
 * the memory graph. Seams sort immediately after the ayah they leave.
 */
export function sortRows(
  rows: readonly ProgressRow[],
  column: SortColumn,
  direction: SortDirection,
): ProgressRow[] {
  const sign = direction === "ascending" ? 1 : -1;
  const keyed = rows.map((row, index) => ({ row, index }));
  keyed.sort((a, b) => {
    const cmp = compare(a.row, b.row, column);
    // A stable tiebreak on the ORIGINAL index, so equal rows keep expand()
    // order and a sort never silently shuffles the graph.
    return cmp !== 0 ? sign * cmp : a.index - b.index;
  });
  return keyed.map((k) => k.row);
}

function compare(a: ProgressRow, b: ProgressRow, column: SortColumn): number {
  switch (column) {
    case "reference":
      // expand() order: by ayah, then ayah-before-seam at the same number.
      if (a.ayah !== b.ayah) return a.ayah - b.ayah;
      return (a.kind === "seam" ? 1 : 0) - (b.kind === "seam" ? 1 : 0);
    case "text":
      return a.text.localeCompare(b.text);
    case "kind":
      return a.kindLabel.localeCompare(b.kindLabel);
    case "stage":
      return STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage];
    case "strength":
      return a.strengthPct - b.strengthPct;
    case "halfLife":
      return numeric(a.halfLifeLabel) - numeric(b.halfLifeLabel);
    case "next":
      return a.nextLabel.localeCompare(b.nextLabel);
    case "time":
      return numeric(a.timeOnTask) - numeric(b.timeOnTask);
  }
}

/** Leading number of a formatted label, or -1 for "—" — so unmeasured rows
 *  sort together at one end rather than scattering. */
function numeric(label: string): number {
  const m = /(\d+(?:\.\d+)?)/.exec(label);
  return m ? Number(m[1]) : -1;
}

/**
 * Filter rows by a query.
 *
 * DELIBERATELY NOT MATCHED: the Arabic text. A learner cannot type Uthmani
 * orthography on a phone keyboard, and a search box that silently returns
 * nothing for the text you can SEE is worse than one that never offered to
 * search it.
 */
export function filterRows(rows: readonly ProgressRow[], query: string): ProgressRow[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [...rows];
  return rows.filter((r) =>
    [r.reference, r.kindLabel, r.stageLabel, r.nextLabel, String(r.surah)]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}
