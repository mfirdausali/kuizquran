// SITE SELECTION FOR A DRILL — which coordinates a run will visit.
//
// This module answers exactly one question: given a chosen RANGE or a chosen
// MUSHAF PAGE, which `Site[]` does the drill visit? It decides nothing about
// grading, ordering, or rendering. It is the "WHAT to drill" half of build-plan
// step 20; the "how to drill it" half already exists in `components/quiz/`.
//
// ---------------------------------------------------------------------------
// WHY A PAGE IS NOT `expand(firstAyahOnPage, lastAyahOnPage)`
// ---------------------------------------------------------------------------
// This is DEFECTS.md#38, and it is the single place in step 20 where the
// obvious implementation is silently, invisibly wrong.
//
// `expand(from, to)` emits every ayah in the range plus every seam BETWEEN
// consecutive ayat — `from..to-1`, and deliberately never a seam AT `to`. That
// is exactly right for a RANGE (it is DEFECTS.md#E-08's by-construction fix:
// a seam at the surah's last ayah is never constructed, so nothing can probe
// past the end of the surah) and exactly WRONG for a PAGE.
//
// A page is not a closed interval. It is a slice of a continuous surah, and
// the transition out of it — the last ayah on this page into the first ayah of
// the next — is a real junction that a hafiz must actually perform. It is, in
// fact, the HARDEST one: it is the moment of physically turning the page.
//
// Resolve each of Yusuf's 14 pages with the naive `expand(first, last)` and the
// arithmetic is brutal:
//
//     97 of 110 seams covered. 13 seams NEVER DRILLED, on any page, ever.
//
// Measured, not reasoned about — the orphans are the seams FROM ayat
// 4, 14, 22, 30, 37, 43, 52, 63, 69, 78, 86, 95, 103, and that count of 13
// matches #38's own tally. The failure is silent by nature: every individual
// page looks complete, and drilling all 14 pages FEELS like total coverage.
// Nothing in a per-page assertion can see it. Only the union can.
//
// THE OWNERSHIP RULE (#38's stated resolution): a boundary seam is owned by the
// range containing its FROM ayah. So a page resolves as
//
//     expand(surah, first, last, ayahCount)          // within-page sites
//   + { kind: "seam", ayah: last }  iff last < ayahCount   // the seam OUT
//
// Because every seam has exactly one FROM ayah, and every ayah lives on exactly
// one page, each seam is claimed by exactly one page. Coverage is total and
// double-counting is impossible — both by construction, not by vigilance.
//
// The `last < ayahCount` guard is what preserves E-08 here. The surah's final
// ayah has no outbound seam, so the final page adds nothing and the terminal
// seam is never constructed. Same invariant `expand` protects, restated at the
// one place that legitimately reaches past `to`.
//
// Note the consequence: a page's site list is a SUPERSET of `expand()`'s, so it
// cannot be expressed by `expand()` alone. That is precisely why this function
// exists in `apps/web/lib` rather than as an engine edit.
//
// The learner-facing consequence is honest, and worth stating plainly: a page
// drill ENDS ON THE SEAM INTO THE NEXT PAGE. That is not an off-by-one leaking
// into the UI — it is the thing turning the page trains.

import { expand, type Site } from "@engine/site.ts";

/** A contiguous mushaf page's ayah span within ONE surah. Cross-surah pages
 *  are sliced to the surah under drill — see `pagesForSurah`. */
export interface PageSpan {
  page: number;
  /** First ayah OF THIS SURAH appearing on the page. */
  firstAyah: number;
  /** Last ayah OF THIS SURAH appearing on the page. */
  lastAyah: number;
  /** True when the page also holds ayat that are NOT part of this surah, i.e.
   *  the surah starts or ends partway down the page. The view labels these
   *  rather than silently cropping them (edge case #11). */
  sharedWithOtherSurah: boolean;
}

/**
 * The sites a RANGE drill visits. A thin pass-through to the engine's own
 * packaging function — deliberately not reimplemented, so a range and the
 * progress table agree about what a range contains.
 *
 * Throws on an out-of-range request, exactly as `expand` does: the caller holds
 * `ayahCount`, so an impossible range is a caller bug and not a runtime
 * condition to clamp away silently.
 */
export function sitesForRange(
  surah: number,
  fromAyah: number,
  toAyah: number,
  ayahCount: number,
): Site[] {
  return expand(surah, fromAyah, toAyah, ayahCount);
}

/**
 * The sites a PAGE drill visits: the within-page sites PLUS the boundary seam
 * leaving the page, which this page owns because that seam's FROM ayah lives
 * here (#38).
 *
 * See this module's header for why the boundary clause is not optional and what
 * exactly goes missing without it.
 */
export function sitesForPage(
  surah: number,
  span: PageSpan,
  ayahCount: number,
): Site[] {
  const sites = expand(surah, span.firstAyah, span.lastAyah, ayahCount);
  // The seam OUT of this page. Owned here because its FROM ayah is here.
  // Guarded so the surah's terminal ayah never grows an outbound seam (E-08).
  if (span.lastAyah < ayahCount) {
    sites.push({ kind: "seam", surah, ayah: span.lastAyah });
  }
  return sites;
}

/** A verse's geometry as the corpus reports it. `page: null` means this build
 *  has no geometry for that verse — never a reason to guess. */
export interface VerseGeometry {
  ayah: number;
  page: number | null;
}

/**
 * Group a surah's verses into page spans, in page order.
 *
 * Returns an EMPTY array when geometry is absent or partial. That is edge case
 * #63's requirement expressed as data: a surah without geometry disables the
 * page picker, and it does so by having no pages to offer rather than by any
 * view remembering to check. A partial map is treated as absent for the same
 * reason a partial map is dangerous — pages built from half a geometry would
 * orphan seams exactly the way #38 describes, while looking complete.
 *
 * `sharedWithOtherSurah` is derived from the ayah count on the page versus the
 * page's own extent: if this surah's ayat do not begin at the page's start or
 * do not run to its end, other content shares it. We cannot see the neighbour
 * surah's verses from here, so the honest signal is positional — the FIRST page
 * of a surah that does not begin the page, and the LAST page that does not fill
 * it, are shared. (Yusuf 12:1 sits at page 235 line 11, so page 235 holds only
 * 4 of its ayat — the canonical instance of #11.)
 */
export function pagesForSurah(verses: readonly VerseGeometry[]): PageSpan[] {
  if (verses.length === 0) return [];
  // Geometry must be TOTAL to be trusted. One null page means the page map is
  // incomplete, and an incomplete page map silently drops seams.
  if (verses.some((v) => v.page === null)) return [];

  const byPage = new Map<number, number[]>();
  for (const v of verses) {
    const page = v.page as number;
    const list = byPage.get(page);
    if (list) list.push(v.ayah);
    else byPage.set(page, [v.ayah]);
  }

  const pages = [...byPage.keys()].sort((a, b) => a - b);
  const firstAyahOfSurah = Math.min(...verses.map((v) => v.ayah));
  const lastAyahOfSurah = Math.max(...verses.map((v) => v.ayah));

  return pages.map((page) => {
    const ayat = byPage.get(page) as number[];
    const firstAyah = Math.min(...ayat);
    const lastAyah = Math.max(...ayat);
    // The surah's opening page is shared unless the surah opens the page;
    // its closing page is shared unless the surah closes the page. A middle
    // page is wholly this surah's by definition.
    const opensSurah = firstAyah === firstAyahOfSurah;
    const closesSurah = lastAyah === lastAyahOfSurah;
    return {
      page,
      firstAyah,
      lastAyah,
      sharedWithOtherSurah: opensSurah || closesSurah,
    };
  });
}
