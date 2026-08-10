// Build-plan step 12: selectFor + replaySelection + the property
// selection_determinism_check (test/selection.test.ts) proves —
// WIREFRAME.md §23 Q2: "record the ordinal, don't derive it," extended to
// the LANE/VARIANT choice itself. `selectFor` is a PURE function of three
// already-recorded facts (site, deviceId, visitOrdinal) — never of `ts`,
// `id`, or log arrival order — so replaying a log in ANY order recovers the
// same selection trace. This is what makes the shuffled-log check provable
// rather than merely tested-and-hoped: shuffle-invariance follows from the
// function signature, not from a coincidence of test data.

import type { Corpus, DrillEvent } from "./types.ts";
import type { Site } from "./site.ts";
import { siteKey } from "./site.ts";
import { admissibleVariants, buildResourceLedger, LANES, type Lane, type Variant } from "./variant.ts";
import { lapPerm, affineIndex } from "./rotation.ts";

/**
 * FNV-1a 32-bit — pure, deterministic, no `Math.random` (INVARIANTS.md
 * Absolute A). Used to derive a per-(site, device[, lane]) rotation seed
 * from recorded string keys, never from anything external.
 */
export function seedFromKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface SelectionResult {
  siteKey: string;
  deviceId: string;
  visitOrdinal: number;
  lane: Lane;
  variantIndex: number;
  variant: Variant;
}

/**
 * The lane-then-variant choice for one recorded visit. Pure function of
 * (corpus content, site, deviceId, visitOrdinal) ONLY — corpus is pinned
 * per event via `corpusHash` (already a frozen wire field, step 10), and
 * site/deviceId/visitOrdinal are all already-recorded facts (WIREFRAME's
 * "selection becomes a written fact"). Returns null only when the site has
 * no admissible lane at all (e.g. a corpus stub with no words).
 *
 * Rotation: lane-first (rotation.ts#lapPerm over the site's ADMISSIBLE lane
 * list — deterministic per corpus, never varies within a session), then an
 * affine cycle within the chosen lane's admitted variant pool
 * (rotation.ts#affineIndex). `deviceId` is folded into both seeds, so two
 * devices visiting the same site never share one rotation sequence
 * (WIREFRAME edge case #48/#49's per-device namespace).
 */
export function selectFor(
  corpus: Corpus,
  site: Site,
  deviceId: string,
  visitOrdinal: number,
): SelectionResult | null {
  if (visitOrdinal < 1) {
    throw new Error(`selectFor: visitOrdinal must be >= 1, got ${visitOrdinal}`);
  }

  const key = siteKey(site);
  const ledger = buildResourceLedger(corpus, site);

  const laneVariants = new Map<Lane, Variant[]>();
  const candidateLanes: Lane[] = [];
  for (const lane of LANES) {
    const admitted = admissibleVariants(corpus, site, lane, ledger);
    if (admitted.length > 0) {
      laneVariants.set(lane, admitted);
      candidateLanes.push(lane);
    }
  }
  if (candidateLanes.length === 0) return null;

  const laneSeed = seedFromKey(`${key}:${deviceId}`);
  const lap = Math.floor((visitOrdinal - 1) / candidateLanes.length);
  const indexInLap = (visitOrdinal - 1) % candidateLanes.length;
  const laneOrder = lapPerm(lap, candidateLanes.length, laneSeed);
  const chosenLane = candidateLanes[laneOrder[indexInLap]!]!;

  // Every lane fires exactly once per lap (lapPerm's own guarantee), so by
  // the time this visit lands in lap `lap`, `chosenLane` has already fired
  // exactly `lap` times — this visit is its (lap + 1)-th.
  const visitCountForLane = lap + 1;
  const pool = laneVariants.get(chosenLane)!;
  const variantSeed = seedFromKey(`${key}:${deviceId}:${chosenLane}`);
  const variantIndex = affineIndex(visitCountForLane - 1, pool.length, variantSeed % pool.length);

  return {
    siteKey: key,
    deviceId,
    visitOrdinal,
    lane: chosenLane,
    variantIndex,
    variant: pool[variantIndex]!,
  };
}

function siteFromEvent(e: DrillEvent): Site | null {
  if (!e.siteKey) return null;
  const parts = e.siteKey.split(":");
  if (parts.length !== 3) return null;
  const kind = parts[1] === "seam" ? "seam" : "ayah";
  return { kind, surah: e.surah, ayah: e.ayah };
}

/**
 * Folds a log (ANY order — arrival, merge, shuffle) into a selection trace
 * keyed by `${siteKey}:${deviceId}:${visitOrdinal}`. Order-independent BY
 * CONSTRUCTION: each entry's value depends only on that event's own
 * (site, deviceId, visitOrdinal), never on other events or fold order —
 * this is the whole selection_determinism_check proof, made structural
 * rather than incidental.
 *
 * `corpusBySurah` supplies the pinned corpus per event's `surah` (a real
 * fold would resolve this via the event's own `corpusHash`, once a corpus
 * store exists — out of scope here; single-corpus-per-surah is assumed).
 * Events missing siteKey/visitOrdinal/deviceId (pre-selection-era, edge
 * case #58) or naming an unknown surah are skipped, never thrown on.
 */
export function replaySelection(
  events: DrillEvent[],
  corpusBySurah: Map<number, Corpus>,
): Map<string, SelectionResult | null> {
  const trace = new Map<string, SelectionResult | null>();
  for (const e of events) {
    if (e.visitOrdinal === undefined || !e.deviceId) continue;
    const site = siteFromEvent(e);
    if (!site) continue;
    const corpus = corpusBySurah.get(e.surah);
    if (!corpus) continue;

    const traceKey = `${e.siteKey}:${e.deviceId}:${e.visitOrdinal}`;
    trace.set(traceKey, selectFor(corpus, site, e.deviceId, e.visitOrdinal));
  }
  return trace;
}

export { LANES };
