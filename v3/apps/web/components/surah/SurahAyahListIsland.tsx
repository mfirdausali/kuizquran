"use client";

// THE AYAT LIST on /surah/[surah] (WIREFRAME §3) — "structure first, then the
// ayat". The macro panel above this list answers "what is this surah about";
// this list is the jump-off point into any one of them.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTED ONLY AS A STUB UNTIL NOW
// ---------------------------------------------------------------------------
// The page shipped with exactly one hardcoded row, "Ayah 1", regardless of
// which surah was open or how many ayat it has — every other real ayah was
// simply missing from a learner-reachable route linked from the dashboard's
// "MY SURAHS" list (`components/home/MySurahs.tsx`) and the library
// (`lib/library/rows.ts`). `lib/progress/rows.ts#rowAtomKey`'s own docblock
// already said "Exported for the surah page's own use" — that caller never
// existed; this file is it.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A CLIENT ISLAND, AND WHY IT REUSES buildProgressRows
// ---------------------------------------------------------------------------
// Edge case #72: a server render has no IndexedDB, so a per-ayah stage/
// strength painted on the server would be a fabricated "Not started" for a
// learner who has carried the ayah for weeks. `buildProgressRows` is the one
// place stage/strength/labels are decided (DEFECTS.md#B2) — the exact
// function `/progress/list` and the ayah-detail route already trust — so this
// island filters its output to `kind === "ayah"` rather than deciding
// anything fresh. The macro panel above already renders the ring/joints, so
// seam rows are deliberately left out of this list — they are not a second,
// competing rendering of the same joints, they are just not this list's job.
//
// THREE STATES, same discipline as ProgressListIsland/AyahStatsIsland:
// pending → skeletons, never zeros (#73); empty → a real "Not started" row
// per ayah, not a missing list — the shape of what's ahead is itself useful;
// broken → say so, name the reason, never silently fall back to empty.

import { useCallback } from "react";
import type { Corpus } from "@engine/types.ts";
import { rebuild } from "@engine/rebuild.ts";
import { getEventsForSurah, useLogState } from "@/lib/idb";
import type { LocalEventRow, LogState } from "@/lib/idb";
import { buildProgressRows, type ProgressRow } from "@/lib/progress/rows";
import { StageBadge } from "@/components/progress/StageBadge";
import Link from "next/link";

export interface SurahAyahListIslandProps {
  /** Corpus is server: arrives as a prop, already loaded. Only the log is
   *  read here. */
  corpus: Corpus;
  /** Resolved once on the server and passed down, so every row in one render
   *  decays to the same instant. */
  now: number;
}

export function SurahAyahListIsland({ corpus, now }: SurahAyahListIslandProps) {
  const surah = corpus.meta.surah;

  // Stable identity: an inline arrow is a new function every render and the
  // effect would re-run forever.
  const selector = useCallback(() => getEventsForSurah(surah), [surah]);
  const isEmpty = useCallback((rows: LocalEventRow[]) => rows.length === 0, []);

  const state = useLogState<LocalEventRow[]>(selector, isEmpty, [surah]);

  return <SurahAyahListView state={state} corpus={corpus} now={now} />;
}

/**
 * THE STATE → VIEW MAPPING, as a pure component — split out and exported so a
 * test can hand it each `LogState` directly, the same reason
 * `AyahStatsIsland.tsx#AyahStatsView` exists as its own export.
 */
export function SurahAyahListView({
  state,
  corpus,
  now,
}: {
  state: LogState<LocalEventRow[]>;
  corpus: Corpus;
  now: number;
}) {
  switch (state.status) {
    case "pending":
      return (
        <div className="stack stack--tight" aria-busy="true">
          <p className="caption">
            <span className="skel" aria-hidden="true" />{" "}
            <span className="sr-only">Reading your progress…</span>
            reading your progress…
          </p>
          <div className="stack stack--tight" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="skel skel--row" />
            ))}
          </div>
        </div>
      );

    case "empty":
      // A designed zero-state, not a missing one — every ayah still gets its
      // own row, reading "Not started", which is the truth for a device that
      // has never drilled this surah.
      return <AyatNav rows={ayahRowsFor(corpus, [], now)} surah={corpus.meta.surah} />;

    case "ready":
      return (
        <AyatNav rows={ayahRowsFor(corpus, state.data, now)} surah={corpus.meta.surah} />
      );

    case "broken":
      return (
        <div className="banner banner--warn" role="alert">
          <p>Your progress for this surah could not be read on this device.</p>
          <p className="sub">
            Reason: <code>{state.reason}</code>. Nothing has been lost — the log
            is append-only and re-readable once storage recovers.
          </p>
        </div>
      );
  }
}

/** Fold the log, then reuse the same row builder every other progress
 *  surface trusts — filtered to ayah rows only (the seams already have a
 *  home in the macro panel above this list). */
function ayahRowsFor(corpus: Corpus, events: LocalEventRow[], now: number): ProgressRow[] {
  const atoms = rebuild(events);
  return buildProgressRows({ corpus, atoms, events, now }).filter((r) => r.kind === "ayah");
}

function AyatNav({ rows, surah }: { rows: ProgressRow[]; surah: number }) {
  return (
    <nav aria-label={`Ayat of surah ${surah}`}>
      {rows.map((row) => (
        <Link key={row.id} href={`/surah/${surah}/${row.ayah}`} className="row-link">
          <span>
            Ayah <span className="ltr-island">{row.ayah}</span>
          </span>
          <StageBadge
            stage={row.stage}
            stageLabel={row.stageLabel}
            strengthPct={row.strengthPct}
            valueLabel={row.strengthLabel}
          />
        </Link>
      ))}
    </nav>
  );
}
