// Site model (build-plan step 11's wire-relevant subset — see DECISIONS.md
// v3-D27 for the explicit scope boundary: this is Site/siteKey/expand/
// visitOrdinal only, not the full admit()/rotation/ResourceLedger design).
//
// WIREFRAME.md §23's spine: "a spec binds to a Site, never to 'an ayah'."
// A seam (junction n->n+1) spans two ayat but a spec still binds to ONE
// coordinate — the seam IS that coordinate, not a special case bolted onto
// ayah n. This is why a junction spec never needs to know it's "different"
// from an ayah spec; both are just Sites.

import { atomKey, type AtomKind } from "./atom.ts";

export type SiteKind = "ayah" | "seam";

export interface Site {
  kind: SiteKind;
  surah: number;
  /** For kind "ayah": the ayah number. For kind "seam": the FROM ayah of
   *  the n -> n+1 junction (matching Connection's own `from` convention). */
  ayah: number;
}

/** Stable key for a Site — same `${surah}:${kind}:${ref}` spirit atomKey
 * uses (E-01), so a seam at ayah n is never confusable with the ayah site
 * at n, and two surahs sharing an ayah number never collide. */
export function siteKey(site: Site): string {
  return `${site.surah}:${site.kind}:${site.ayah}`;
}

/** TOTAL: every Site maps to exactly one atom key. `ayah` sites map to
 * their own ayah atom; `seam` sites map to the CONNECTION atom (ref = the
 * seam's own `ayah`, i.e. the `from` ayah of the junction it represents) —
 * WIREFRAME.md's own words: "the seam's atom key is connection:n". */
export function siteToAtomKey(site: Site): string {
  const kind: AtomKind = site.kind === "seam" ? "connection" : "ayah";
  return atomKey(site.surah, kind, site.ayah);
}

/**
 * Packaging (WIREFRAME.md Q3): expand a range [fromAyah, toAyah] into its
 * full Site[] — every ayah in the range, plus every seam BETWEEN
 * consecutive ayat in the range (from..to-1, never a seam AT `to`). This is
 * the exact mechanism DEFECTS.md#E-08 cites as its by-construction fix:
 * a seam at the surah's last ayah is never CONSTRUCTED in the first place,
 * so there is no reachable input that could probe past the end of the
 * surah — no bound check needed because there is nothing to bound.
 *
 * Throws on an out-of-range request (fromAyah/toAyah outside
 * [1, ayahCount], or fromAyah > toAyah) — the caller already supplies
 * `ayahCount`, so an out-of-range call is a caller bug, not a runtime
 * condition to silently clamp away.
 */
export function expand(surah: number, fromAyah: number, toAyah: number, ayahCount: number): Site[] {
  if (fromAyah < 1 || toAyah > ayahCount || fromAyah > toAyah) {
    throw new Error(
      `expand: invalid range [${fromAyah}, ${toAyah}] for surah ${surah} (ayahCount ${ayahCount})`,
    );
  }
  const sites: Site[] = [];
  for (let n = fromAyah; n <= toAyah; n++) {
    sites.push({ kind: "ayah", surah, ayah: n });
    if (n < toAyah) sites.push({ kind: "seam", surah, ayah: n });
  }
  return sites;
}

/**
 * WIREFRAME.md Q2: "record the ordinal, don't derive it." Given every
 * visitOrdinal already recorded for a site (in ANY order — arrival order,
 * merge order, doesn't matter), the next one is `max(recorded) + 1`.
 * Commutative and set-monotone: immune to sync/merge reordering and to
 * re-seeing the same ordinal twice (a device's own event re-arriving).
 * An empty history starts at 1.
 */
export function nextVisitOrdinal(recorded: number[]): number {
  if (recorded.length === 0) return 1;
  return Math.max(...recorded) + 1;
}
