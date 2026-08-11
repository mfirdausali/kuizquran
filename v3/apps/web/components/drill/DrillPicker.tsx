"use client";

// THE DRILL PICKER — choosing WHAT to drill. It never drills anything.
//
// ---------------------------------------------------------------------------
// THIS COMPONENT DECIDES NOTHING
// ---------------------------------------------------------------------------
// Every question worth asking about a proposed drill — which sites, which are
// skipped and why, how long it takes, what a slip costs — is answered in
// `lib/drill/` and arrives here as a `DrillPreview`. This file reads fields off
// that object and puts them in elements. That is check-boundaries.mjs clause 5,
// and it is the reason the seam-ownership rule (#38) cannot be quietly
// re-derived here into something that disagrees with the engine.
//
// The log is read HERE rather than on the server (edge case #72): a server
// render has no IndexedDB, so every ayah would look un-learned, the preview
// would say "0 of 10 ready", and React would keep that lie in production.
//
// ---------------------------------------------------------------------------
// THE TWO MODES ARE PRESENTED AS CONSEQUENCES, NOT AS JARGON
// ---------------------------------------------------------------------------
// A learner does not know what "structured" means and should never have to.
// Both radio options carry the sentence that tells them what a mistake costs,
// and that sentence is `preview.consequenceLabel` — computed in lib/, so the
// wording cannot drift away from the boolean it describes.
//
// Neither mode is preselected as a silent default in the dangerous direction:
// graded is the default because it is what a normal review IS, and the cost of
// that choice is stated on screen before the learner starts rather than
// discovered afterwards in a strength drop.

import { useCallback, useMemo, useState } from "react";
import type { Corpus } from "@engine/types.ts";
import { rebuild } from "@engine/rebuild.ts";
import { getEventsForSurah, useLogState } from "@/lib/idb";
import type { LocalEventRow } from "@/lib/idb";
import {
  buildDrillPreview,
  formatMinutes,
  type DrillMode,
  type DrillPreview,
} from "@/lib/drill/preview";
import {
  pagesForSurah,
  sitesForPage,
  sitesForRange,
  type PageSpan,
} from "@/lib/drill/sites";

interface DrillPickerProps {
  corpus: Corpus;
  /** Passed in rather than read from a clock here, so a test can freeze it. */
  now: number;
}

type Selection =
  | { kind: "range"; from: number; to: number }
  | { kind: "page"; page: number };

export function DrillPicker({ corpus, now }: DrillPickerProps) {
  const surah = corpus.meta.surah;
  const ayahCount = corpus.meta.ayahCount;

  const selector = useCallback(() => getEventsForSurah(surah), [surah]);
  const isEmpty = useCallback((rows: LocalEventRow[]) => rows.length === 0, []);
  const state = useLogState<LocalEventRow[]>(selector, isEmpty, [surah]);

  const [selection, setSelection] = useState<Selection>({
    kind: "range",
    from: 1,
    to: Math.min(6, ayahCount),
  });
  const [mode, setMode] = useState<DrillMode>("graded");

  // The page map. Empty when this build has no geometry for the surah, which
  // is what disables the page picker — edge case #63, expressed as an absence
  // of options rather than as a check anyone has to remember.
  const pages: PageSpan[] = useMemo(
    () => pagesForSurah(corpus.verses.map((v) => ({ ayah: v.ayah, page: v.page }))),
    [corpus],
  );

  // `empty` is a real, readable log with no events in it — the first-run state,
  // in which nothing is drillable and the preview says so honestly. Only
  // `pending` and `broken` withhold a preview, because in those two cases we do
  // not KNOW what is learned, and guessing would paint a wrong denominator.
  const events = state.status === "ready" ? state.data : [];
  const logIsPending = state.status === "pending";
  const logIsBroken = state.status === "broken";

  const preview: DrillPreview | null = useMemo(() => {
    if (logIsPending || logIsBroken) return null;
    const atoms = rebuild(events);
    let sites;
    try {
      sites =
        selection.kind === "range"
          ? sitesForRange(surah, selection.from, selection.to, ayahCount)
          : (() => {
              const span = pages.find((p) => p.page === selection.page);
              return span ? sitesForPage(surah, span, ayahCount) : [];
            })();
    } catch {
      // An impossible range is a caller bug, but a half-typed number in an
      // input must not throw a render. No sites means nothing to start.
      return null;
    }
    return buildDrillPreview({ sites, atoms, mode });
  }, [events, selection, mode, surah, ayahCount, pages, logIsPending, logIsBroken]);

  const clampFrom = (n: number) => Math.min(Math.max(1, n), ayahCount);

  return (
    <div className="stack">
      <fieldset className="drill-fieldset">
        <legend className="drill-legend">What to drill</legend>

        <div className="drill-row">
          <label className="drill-label" htmlFor="from-ayah">
            From ayah
          </label>
          <input
            id="from-ayah"
            className="drill-input"
            type="number"
            min={1}
            max={ayahCount}
            value={selection.kind === "range" ? selection.from : ""}
            disabled={selection.kind !== "range"}
            onChange={(e) => {
              const from = clampFrom(Number(e.target.value));
              setSelection((s) =>
                s.kind === "range" ? { kind: "range", from, to: Math.max(from, s.to) } : s,
              );
            }}
          />
          <label className="drill-label" htmlFor="to-ayah">
            To ayah
          </label>
          <input
            id="to-ayah"
            className="drill-input"
            type="number"
            min={1}
            max={ayahCount}
            value={selection.kind === "range" ? selection.to : ""}
            disabled={selection.kind !== "range"}
            onChange={(e) => {
              const to = clampFrom(Number(e.target.value));
              setSelection((s) =>
                s.kind === "range" ? { kind: "range", from: Math.min(s.from, to), to } : s,
              );
            }}
          />
        </div>

        {selection.kind !== "range" ? (
          <button
            type="button"
            className="drill-switch"
            onClick={() => setSelection({ kind: "range", from: 1, to: Math.min(6, ayahCount) })}
          >
            Choose a range of ayat instead
          </button>
        ) : null}

        {/* THE PAGE PICKER. Rendered only when geometry exists (#63). When it
            does not, the honest thing is to say the feature is unavailable in
            this build — never to guess a page map. */}
        {pages.length > 0 ? (
          <div className="drill-pages">
            <span className="drill-label" id="page-label">
              Or a mushaf page
            </span>
            <div className="drill-page-list" role="group" aria-labelledby="page-label">
              {pages.map((p) => (
                <button
                  key={p.page}
                  type="button"
                  className="drill-page"
                  aria-pressed={selection.kind === "page" && selection.page === p.page}
                  onClick={() => setSelection({ kind: "page", page: p.page })}
                >
                  <span className="drill-page-n">Page {p.page}</span>
                  <span className="drill-page-span">
                    {p.firstAyah}–{p.lastAyah}
                  </span>
                  {/* Edge case #11: a page the surah shares with its neighbour
                      is LABELLED, never silently cropped to look whole. */}
                  {p.sharedWithOtherSurah ? (
                    <span className="drill-page-shared">shares this page</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="stub-note">
            Page drills aren&apos;t available for this surah in this build — the
            corpus has no mushaf geometry for it, and a page map must never be
            guessed.
          </p>
        )}
      </fieldset>

      <fieldset className="drill-fieldset">
        <legend className="drill-legend">How it counts</legend>
        {/* The consequence, never the jargon — and never hidden. */}
        <label className="drill-mode">
          <input
            type="radio"
            name="drill-mode"
            value="graded"
            checked={mode === "graded"}
            onChange={() => setMode("graded")}
          />
          <span className="drill-mode-name">Graded review</span>
          <span className="drill-mode-consequence">Slips will lower your strength.</span>
        </label>
        <label className="drill-mode">
          <input
            type="radio"
            name="drill-mode"
            value="victory-lap"
            checked={mode === "victory-lap"}
            onChange={() => setMode("victory-lap")}
          />
          <span className="drill-mode-name">Victory lap</span>
          <span className="drill-mode-consequence">
            Nothing can be damaged; this still counts toward your streak.
          </span>
        </label>
      </fieldset>

      {logIsPending ? (
        // A skeleton, never a zero: painting "0 ayat ready" while the log is
        // still loading is the same lie as an SSR'd zero (edge case #73).
        <div className="stack stack--tight" aria-busy="true">
          {/* One copy of the sentence, visible AND announced. Duplicating it
              into an sr-only sibling makes a screen reader say it twice. */}
          <p className="caption">Reading your progress…</p>
          <span className="skel skel--row" aria-hidden="true" />
        </div>
      ) : logIsBroken ? (
        <div className="banner banner--warn" role="alert">
          <p>Your progress could not be read on this device.</p>
          <p className="sub">
            Until it can, this picker cannot say which ayat are ready — and it
            will not guess. Nothing has been lost; the log is append-only.
          </p>
        </div>
      ) : preview === null ? (
        <p className="stub-note">Choose a range or a page to see what this will cover.</p>
      ) : (
        <DrillSummary preview={preview} />
      )}
    </div>
  );
}

/** The preview, rendered. Every number here was decided in lib/drill. */
function DrillSummary({ preview }: { preview: DrillPreview }) {
  return (
    <section className="drill-summary" aria-live="polite">
      <p className="drill-counts">
        <strong>{preview.ayahCount}</strong> ayat ·{" "}
        <strong>{preview.seamCount}</strong> joints ·{" "}
        <strong>{formatMinutes(preview.estimatedMinutes)}</strong>
      </p>

      {/* The honest denominator, stated BEFORE the run rather than discovered
          as a low score after it. Absent entirely when nothing is skipped. */}
      {preview.partialNotice !== null ? (
        <p className="drill-partial">{preview.partialNotice}</p>
      ) : null}

      <p className="drill-consequence">{preview.consequenceLabel}</p>

      {preview.stepCount === 0 ? (
        <p className="stub-note">
          Nothing here has been learned yet, so there is nothing to drill. Learn
          an ayah first and it will appear here.
        </p>
      ) : (
        <p className="caption">
          {preview.stepCount} steps. A page drill ends on the joint into the next
          page — the page turn itself.
        </p>
      )}
    </section>
  );
}
