// MACRO CLASSIFICATION — v3-D21, emitted at BUILD TIME.
//
// ---------------------------------------------------------------------------
// WHY THIS IS HERE AND NOT IN THE ENGINE OR THE UI
// ---------------------------------------------------------------------------
// v3-D21: "Four archetypes, first match wins: ATOMIC (<=8 ayat -> no panel) ·
// RING (ruku >= 4) · LITANY (dominant rhyme >= 70% or a verbatim refrain) ·
// ARC (everything else)."
//
// Classification depends on ZERO learner state — the same surah classifies
// identically for every learner, forever. So:
//
//   - NOT the engine (v3/CLAUDE.md rule 3 forbids editing packages/engine/src
//     anyway, and the engine's job is per-learner scheduling; putting a
//     learner-invariant constant behind a per-learner call recomputes 43
//     constants on every page view).
//   - NOT the UI. `ayahCount <= 8` in a .tsx is a DECISION IN A VIEW —
//     v3/CLAUDE.md rule 4. A gate that happens not to catch a violation does
//     not make the violation legal; check-boundaries.mjs clause 5 is extended
//     for exactly this in step 19.
//   - HERE: deterministic, learner-invariant, content-addressed. It rides the
//     existing 16-hex corpus hash, so a classification change invalidates
//     caches exactly like any other corpus change.
//
// The archetype ships as a LITERAL STRING so the UI's only operation is a
// lookup, never a comparison. Every threshold in v3-D21 is expressed ONCE,
// here, and never again.
//
// ---------------------------------------------------------------------------
// SACRED TEXT
// ---------------------------------------------------------------------------
// `rhymeLabel` is a TRANSLITERATION produced from a rhyme CLASS id, never a
// slice of Quranic Arabic. The rhyme profile is computed over the corpus's own
// verse text at build time and reduced to a class id + a share; not one Arabic
// byte is written into this file, and none is carried in MacroFacts.
// v3/INVARIANTS.md Absolute B.

/** v3-D21's four archetypes. A literal string — the UI looks it up, never
 *  computes it. */
export type MacroArchetype = "ATOMIC" | "RING" | "LITANY" | "ARC";

/** Geometry inside the RING panel — edge case #89 ("ring on <=9-ayat surahs
 *  => meaningless arcs; flat 1->N strip with identical stage semantics").
 *  Emitted as a string for the same reason the archetype is. */
export type MacroLayout = "arc" | "strip";

export interface MacroRingSegment {
  from: number;
  to: number;
  label: string | null;
}

export interface MacroArcBeat {
  from: number;
  to: number;
  label: string;
  /** True when this beat was DERIVED (an even partition), not authored.
   *  Drives the visible honesty label — see `authored`. */
  derived: boolean;
}

export interface MacroFacts {
  archetype: MacroArchetype;
  /** Which rule fired, in v3-D21's words: "ayahCount=3" | "ruku=4" |
   *  "rhyme -uun 78%" | "refrain x3" | "default". Rendered nowhere by
   *  default; present so a classification can be explained and tested. */
  reason: string;
  /** Geometry for whichever panel renders. #89's threshold lives HERE, next
   *  to v3-D21's, so the two adjacent-but-different numbers cannot drift
   *  apart in separate files. */
  layout: MacroLayout;
  /** FALSE until the M9 authoring budget lands real beats (edge case #22:
   *  "macro authoring = budgeted M9 item per launch surah"). While false, the
   *  panel must carry a VISIBLE label marking its structure as derived —
   *  WIREFRAME §10's honesty rule applied to structure rather than to
   *  numbers. */
  authored: boolean;
  ring?: { rukuCount: number; segments: MacroRingSegment[] };
  litany?: { refrainAyat: number[]; rhymeShare: number; rhymeLabel: string };
  arc?: { beats: MacroArcBeat[] };
}

// ---------------------------------------------------------------------------
// THE THRESHOLDS. All of them. Nowhere else.
// ---------------------------------------------------------------------------

/** v3-D21: ATOMIC is `<= 8` ayat — "at 3-8 ayat the list is already the macro
 *  view", so ATOMIC renders NO PANEL at all.
 *
 *  NOTE THE DELIBERATE GAP with STRIP_MAX_AYAT below (9, not 8). A 9-ayah
 *  surah with ruku >= 4 is RING-classified but STRIP-rendered. That is not a
 *  contradiction: v3-D21 governs WHICH PANEL, edge case #89 governs WHICH
 *  GEOMETRY inside the ring panel. Both appear independently ratified. They
 *  are kept adjacent, each commenting the other, because two nearby-but-
 *  different constants in separate files is precisely how one of them
 *  silently gets "fixed" to match the other. If they were meant to be one
 *  number, that is a DECISIONS.md entry — not a code reconciliation. */
export const ATOMIC_MAX_AYAT = 8;

/** Edge case #89's ratified threshold: at or below this, the ring's arcs are
 *  meaningless and the panel renders a flat 1->N strip instead. See the note
 *  on ATOMIC_MAX_AYAT for why this is 9 and that is 8. */
export const STRIP_MAX_AYAT = 9;

/** v3-D21: RING is `ruku >= 4`. */
export const RING_MIN_RUKU = 4;

/** v3-D21: LITANY is "dominant rhyme >= 70%". */
export const LITANY_MIN_RHYME_SHARE = 0.7;

/** A refrain must recur at least this many times to count as "a verbatim
 *  refrain" (v3-D21's second LITANY limb). Two occurrences is a coincidence
 *  in a long surah; three is a structure. */
export const LITANY_MIN_REFRAIN = 3;

/** Input to the classifier. Deliberately NOT `Corpus` — the classifier needs
 *  four facts, and taking the whole corpus would let it grow a dependency on
 *  anything in it. `rukuCount` comes from Tanzil metadata (already the locked
 *  numbering basis, edge case #13); `verseTails` and `verseTexts` come from
 *  the compiler's own verse rows. */
export interface MacroInput {
  ayahCount: number;
  /** Tanzil ruku count for this surah. 0/undefined when unknown — an unknown
   *  ruku count must never SATISFY the RING rule (see classify). */
  rukuCount?: number;
  /** Rhyme class id per ayah, in ayah order, as produced by `rhymeClassOf`.
   *  Never Arabic — a transliterated class id. */
  rhymeClasses?: string[];
  /** Normalized verse text per ayah, in ayah order, used ONLY for
   *  equality-comparison to detect a verbatim refrain. Never emitted. */
  verseTexts?: string[];
}

/**
 * v3-D21, FIRST MATCH WINS, IN THIS ORDER. The order is load-bearing and is
 * asserted by test: a 6-ayah surah with ruku >= 4 is ATOMIC, not RING,
 * because ATOMIC is matched first. Reordering these checks changes the
 * answer for real surahs, so the tests assert the ORDER, not merely the
 * outcomes.
 */
export function classify(input: MacroInput): MacroFacts {
  const { ayahCount } = input;
  const layout: MacroLayout = ayahCount <= STRIP_MAX_AYAT ? "strip" : "arc";

  // 1. ATOMIC — no panel at all. Matched FIRST.
  if (ayahCount <= ATOMIC_MAX_AYAT) {
    return {
      archetype: "ATOMIC",
      reason: `ayahCount=${ayahCount}`,
      layout,
      // Nothing is being withheld on ATOMIC — there is no panel to label.
      authored: true,
    };
  }

  // 2. RING — ruku >= 4. An UNKNOWN ruku count can never satisfy this: a
  //    missing input must not be able to manufacture a classification.
  const ruku = input.rukuCount ?? 0;
  if (ruku >= RING_MIN_RUKU) {
    return {
      archetype: "RING",
      reason: `ruku=${ruku}`,
      layout,
      authored: true,
      ring: { rukuCount: ruku, segments: evenSegments(ayahCount, ruku) },
    };
  }

  // 3. LITANY — dominant rhyme >= 70%, OR a verbatim refrain.
  const rhyme = dominantRhyme(input.rhymeClasses ?? []);
  const refrainAyat = verbatimRefrain(input.verseTexts ?? []);
  if (rhyme !== null && rhyme.share >= LITANY_MIN_RHYME_SHARE) {
    return {
      archetype: "LITANY",
      reason: `rhyme ${rhyme.label} ${Math.round(rhyme.share * 100)}%`,
      layout,
      authored: true,
      litany: { refrainAyat, rhymeShare: rhyme.share, rhymeLabel: rhyme.label },
    };
  }
  if (refrainAyat.length >= LITANY_MIN_REFRAIN) {
    return {
      archetype: "LITANY",
      reason: `refrain x${refrainAyat.length}`,
      layout,
      authored: true,
      litany: {
        refrainAyat,
        rhymeShare: rhyme?.share ?? 0,
        rhymeLabel: rhyme?.label ?? "",
      },
    };
  }

  // 4. ARC — everything else. Its beats are AUTHORED CONTENT budgeted to M9
  //    (edge case #22). Until then they are derived and MUST say so.
  return {
    archetype: "ARC",
    reason: "default",
    layout,
    authored: false,
    arc: { beats: derivedBeats(ayahCount) },
  };
}

/** Partition 1..ayahCount into `n` contiguous segments as evenly as
 *  possible. Used for ring segments and for derived ARC beats. Never claims
 *  to be authored structure. */
export function evenSegments(ayahCount: number, n: number): MacroRingSegment[] {
  const parts = Math.max(1, Math.min(n, ayahCount));
  const out: MacroRingSegment[] = [];
  const base = Math.floor(ayahCount / parts);
  const extra = ayahCount % parts;
  let cursor = 1;
  for (let i = 0; i < parts; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push({ from: cursor, to: cursor + size - 1, label: null });
    cursor += size;
  }
  return out;
}

/** ARC's fallback structure: three even parts, every beat flagged
 *  `derived: true` so the panel can label it honestly. Replaced wholesale by
 *  authored beats at M9. */
export function derivedBeats(ayahCount: number): MacroArcBeat[] {
  return evenSegments(ayahCount, 3).map((s, i) => ({
    from: s.from,
    to: s.to,
    label: `Part ${i + 1}`,
    derived: true,
  }));
}

/** The most common rhyme class and its share of all ayat. Null for an empty
 *  input — an absent profile must not read as "0% of something". */
export function dominantRhyme(classes: string[]): { label: string; share: number } | null {
  if (classes.length === 0) return null;
  const counts = new Map<string, number>();
  for (const c of classes) {
    if (c === "") continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [c, n] of counts) {
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  if (best === null) return null;
  return { label: best, share: bestN / classes.length };
}

/** Ayah numbers (1-based) of the most-repeated verbatim verse, when it
 *  repeats at all. Compares NORMALIZED TEXT FOR EQUALITY ONLY — it never
 *  stores or emits the text. Returns [] when nothing repeats. */
export function verbatimRefrain(verseTexts: string[]): number[] {
  const seen = new Map<string, number[]>();
  verseTexts.forEach((t, i) => {
    const key = t.trim();
    if (key === "") return;
    const list = seen.get(key) ?? [];
    list.push(i + 1);
    seen.set(key, list);
  });
  let best: number[] = [];
  for (const list of seen.values()) {
    if (list.length > best.length) best = list;
  }
  return best.length >= 2 ? best : [];
}
