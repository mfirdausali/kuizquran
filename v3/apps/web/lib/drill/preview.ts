// THE DRILL PREVIEW — every decision about a proposed drill, made here so that
// none of them is made in a view (check-boundaries.mjs clause 5).
//
// The picker's job is to let a learner commit to a run with an accurate idea of
// what they are committing to. Three things have to be true before they tap
// Start, and each is a decision, so each lives in this file:
//
//   1. WHAT will be drilled, and what will be SKIPPED and why;
//   2. HOW LONG it will take, from the engine's own cost model;
//   3. WHAT IT COSTS THEM IF THEY SLIP — graded, or a free victory lap.
//
// ---------------------------------------------------------------------------
// PARTIAL PAGES: SKIPPED IS NOT FAILED, AND THE DENOMINATOR IS HONEST
// ---------------------------------------------------------------------------
// A page will routinely contain ayat the learner has never learned. Those must
// not be drilled — reconstructing an ayah you have never encoded is not a
// retrieval, it is a guess, and grading it would damage an atom that never had
// a chance.
//
// The mechanism already exists as the BUG-3 gap guard: skip when there is no
// atom at all, and for an ayah site when `atom.encoded` is false (S3 whole-bank
// never completed, so there is nothing to retrieve).
//
// The important design choice is WHEN this is computed: BEFORE the run, not
// after. If the partition happened during the drill, the learner would commit
// to "10 ayat" and receive 7, which reads as failure. Computed here, the
// preview states the real denominator up front and the result reads
// "7 of 7 of what you've learned" — never "7/10", which would paint a
// three-quarters-ready page as a 30% failure.
//
// ---------------------------------------------------------------------------
// THE ESTIMATE COMES FROM `estMinutes`, NOT FROM A NUMBER IN A DOC
// ---------------------------------------------------------------------------
// `capacity.ts#estMinutes` is the shipped cost model the planner already uses
// (1.25/chain + 0.17/junction, Appendix A). The preview calls it rather than
// carrying its own arithmetic, so the picker and the daily plan can never
// disagree about what a piece of work costs.
//
// Worth recording, since WIREFRAME §13 says otherwise: §13's worked example of
// 6 ayat + 5 junctions is annotated "est. 8.6 min", but the shipped model gives
// 1.25·6 + 0.17·5 = 8.35. The doc's figure is not reproducible from the code.
// The code is the authority here; §13's number is illustrative prose.
//
// ---------------------------------------------------------------------------
// GRADED vs VICTORY LAP — ONE BOOLEAN, STATED AS A CONSEQUENCE
// ---------------------------------------------------------------------------
// Both modes reduce to `RetrievalOutcome.structured`, which `update.ts:71`
// already honours: `if (!outcome.structured) return atom;`. A victory lap
// therefore needs no new engine code — the atom comes back untouched, so a slip
// cannot cost strength, while `chain_step` / `junction_result` still append to
// the log and the run still counts toward streak and heatmap.
//
// The picker must state the CONSEQUENCE, never the jargon. "Graded" and
// "victory lap" are our words, not the learner's, and the thing they actually
// need to know is whether a mistake can hurt them. Hiding it makes a victory
// lap feel unsafe; defaulting silently to graded would quietly damage strong
// verses during what the learner intended as a celebration.

import type { AtomState } from "@engine/atom.ts";
import { estMinutes } from "@engine/capacity.ts";
import { siteToAtomKey, type Site } from "@engine/site.ts";

/** The two ways a run can treat a mistake. One boolean at the wire, but never
 *  presented to a learner as a boolean. */
export type DrillMode = "graded" | "victory-lap";

/** `RetrievalOutcome.structured` for a mode. THE only place the mapping is
 *  made, so a mode can never be half-applied. */
export function structuredFor(mode: DrillMode): boolean {
  return mode === "graded";
}

/** Why a site is not being drilled. `null` when it IS being drilled.
 *
 *  There is deliberately only ONE reason for an ayah, because from the
 *  learner's side there is only one situation: they have not learned it yet.
 *  "No atom row exists" and "the atom exists but was never encoded" are the
 *  same fact told in storage terms, and splitting them would put an
 *  implementation detail on screen — and, worse, would let a never-touched
 *  ayah render a different message from a half-started one for no reason the
 *  learner could act on. Seams keep their own reason because a missing
 *  connection atom genuinely is a different thing: the junction has not been
 *  reached yet, not failed. */
export type SkipReason = "not-learned" | "seam-not-reached";

export interface PreviewSite {
  site: Site;
  atomKey: string;
  drilled: boolean;
  /** Null when drilled. Otherwise the honest reason, for the view to print. */
  skipReason: SkipReason | null;
}

export interface DrillPreview {
  sites: PreviewSite[];
  /** Sites that will actually be visited, in order. */
  drilledSites: Site[];
  /** Ayah sites that will be drilled. */
  ayahCount: number;
  /** Seam sites that will be drilled. */
  seamCount: number;
  /** Ayah sites SKIPPED because they are not yet learned. */
  skippedAyahCount: number;
  /** Seam sites skipped because their connection atom does not exist yet. */
  skippedSeamCount: number;
  /** Total steps that will be drilled (ayat + seams). */
  stepCount: number;
  /** Engine-computed minutes for the drilled work only. */
  estimatedMinutes: number;
  mode: DrillMode;
  /** `structured` for every outcome this run logs. */
  structured: boolean;
  /** The consequence of a slip, in the learner's terms. Never jargon. */
  consequenceLabel: string;
  /** Present only when something is skipped — the honest up-front explanation
   *  of the denominator. Null when the whole selection is drillable, so the
   *  view has nothing to render rather than rendering a reassuring no-op. */
  partialNotice: string | null;
}

export interface BuildPreviewInput {
  sites: readonly Site[];
  atoms: ReadonlyMap<string, AtomState>;
  mode: DrillMode;
}

/**
 * Decide a drill before it runs.
 *
 * A site is drilled when its atom exists and — for an ayah — has been encoded.
 */
export function buildDrillPreview(input: BuildPreviewInput): DrillPreview {
  const { sites, atoms, mode } = input;

  const previewSites: PreviewSite[] = sites.map((site) => {
    const atomKey = siteToAtomKey(site);
    const atom = atoms.get(atomKey);
    // BUG-3 gap guard. An ayah is drillable only once it is ENCODED (S3
    // whole-bank completed at least once); a missing atom and an un-encoded
    // one are the same fact, so they report the same reason.
    if (site.kind === "ayah") {
      if (!atom || !atom.encoded) {
        return { site, atomKey, drilled: false, skipReason: "not-learned" };
      }
      return { site, atomKey, drilled: true, skipReason: null };
    }
    // A seam needs only its connection atom to exist: a junction is a
    // recognition check between two ayat, not a reconstruction of one, so
    // `encoded` is not the right gate and requiring it would skip seams the
    // learner can plainly perform.
    if (!atom) {
      return { site, atomKey, drilled: false, skipReason: "seam-not-reached" };
    }
    return { site, atomKey, drilled: true, skipReason: null };
  });

  const drilled = previewSites.filter((p) => p.drilled);
  const drilledSites = drilled.map((p) => p.site);
  const ayahCount = drilled.filter((p) => p.site.kind === "ayah").length;
  const seamCount = drilled.filter((p) => p.site.kind === "seam").length;
  const skipped = previewSites.filter((p) => !p.drilled);
  const skippedAyahCount = skipped.filter((p) => p.site.kind === "ayah").length;
  const skippedSeamCount = skipped.filter((p) => p.site.kind === "seam").length;

  // The engine's cost model, never a local formula. Chains are ayat, junctions
  // are seams; a picker adds no new words and no due reviews.
  const estimatedMinutes = estMinutes({
    newWords: 0,
    dueReviews: 0,
    chains: ayahCount,
    junctions: seamCount,
  });

  const totalAyat = ayahCount + skippedAyahCount;

  return {
    sites: previewSites,
    drilledSites,
    ayahCount,
    seamCount,
    skippedAyahCount,
    skippedSeamCount,
    stepCount: drilled.length,
    estimatedMinutes,
    mode,
    structured: structuredFor(mode),
    consequenceLabel:
      mode === "graded"
        ? "Slips will lower your strength."
        : "Nothing can be damaged; this still counts toward your streak.",
    partialNotice:
      skippedAyahCount > 0
        ? `${ayahCount} of ${totalAyat} ayat here are ready. ` +
          `The other ${skippedAyahCount} haven't been learned yet — ` +
          `they'll be skipped, not marked wrong.`
        : null,
  };
}

/** Minutes, rounded for display. A single place, so two screens cannot round
 *  the same estimate differently. */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes < 1) return "under a minute";
  return `${Math.round(minutes * 10) / 10} min`;
}
