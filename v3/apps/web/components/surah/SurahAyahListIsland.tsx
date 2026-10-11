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
// function `/progress/list` and the ayah-detail route already trust.
//
// ---------------------------------------------------------------------------
// CORRECTED (v3-D305, Finding A at v3-D301): ATOMIC surahs show their
// joints HERE — they are not "the macro panel's job" for every archetype.
// ---------------------------------------------------------------------------
// This file used to filter its output to `kind === "ayah"` UNCONDITIONALLY,
// on the reasoning that "the macro panel above already renders the ring/
// joints". That is true for RING/LITANY/ARC, whose `RingDiagram` shows every
// seam as its own mark — but `MacroPanel.tsx` itself returns `null` for
// ATOMIC (v3-D21: "at 3-8 ayat the list is already the macro view"), and that
// very file's own comment states the precondition this list must satisfy for
// that claim to be TRUE rather than merely asserted: "the ayah list on this
// page renders the seams between its rows... A 3-ayah surah then shows 3
// ayah rows and 2 joint rows — 5 marks, the complete memory graph... Without
// that, ATOMIC would be the WORST case for edge case #90 rather than an
// exempt one: no panel AND no seams is 40% of Al-Asr invisible." This file
// never built that half, so every ATOMIC surah (Al-Asr, Al-Ikhlas) showed
// zero joints anywhere a learner could see.
//
// Fixed by passing `archetype` down as DATA (computed once, server-side, by
// the same `macroFactsFor()` the page already calls for the macro panel —
// never recomputed here, and never imported as a value in this client
// island, which would ship the compiler's classifier to the browser) and
// showing seam rows IFF `archetype === "ATOMIC"`. A seam has no detail route
// of its own (E-08), so it renders as a plain row, never a fifth `<a>`.
//
// THREE STATES, same discipline as ProgressListIsland/AyahStatsIsland:
// pending → skeletons, never zeros (#73); empty → a real "Not started" row
// per ayah (and, for ATOMIC, per joint too), not a missing list — the shape
// of what's ahead is itself useful; broken → say so, name the reason, never
// silently fall back to empty.

import { useCallback } from "react";
import type { Corpus } from "@engine/types.ts";
import { rebuild } from "@engine/rebuild.ts";
import { getEventsForSurah, useLogState } from "@/lib/idb";
import type { LocalEventRow, LogState } from "@/lib/idb";
import { buildProgressRows, type ProgressRow } from "@/lib/progress/rows";
import { StageBadge } from "@/components/progress/StageBadge";
import type { MacroArchetype } from "@/components/macro/facts.ts";
import Link from "next/link";

export interface SurahAyahListIslandProps {
  /** Corpus is server: arrives as a prop, already loaded. Only the log is
   *  read here. */
  corpus: Corpus;
  /** Resolved once on the server and passed down, so every row in one render
   *  decays to the same instant. */
  now: number;
  /** v3-D21's archetype for this surah — decided once, server-side, by
   *  `macroFactsFor()` (the same call the page makes for the macro panel
   *  above this list) and handed down as data. Decides ONE thing here:
   *  whether this list must also carry the joints (see the header above). */
  archetype: MacroArchetype;
}

export function SurahAyahListIsland({ corpus, now, archetype }: SurahAyahListIslandProps) {
  const surah = corpus.meta.surah;

  // Stable identity: an inline arrow is a new function every render and the
  // effect would re-run forever.
  const selector = useCallback(() => getEventsForSurah(surah), [surah]);
  const isEmpty = useCallback((rows: LocalEventRow[]) => rows.length === 0, []);

  const state = useLogState<LocalEventRow[]>(selector, isEmpty, [surah]);

  return <SurahAyahListView state={state} corpus={corpus} now={now} archetype={archetype} />;
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
  archetype,
}: {
  state: LogState<LocalEventRow[]>;
  corpus: Corpus;
  now: number;
  archetype: MacroArchetype;
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
      // A designed zero-state, not a missing one — every ayah (and, for
      // ATOMIC, every joint) still gets its own row, reading "Not started",
      // which is the truth for a device that has never drilled this surah.
      return (
        <AyatNav
          rows={rowsFor(corpus, [], now, archetype)}
          surah={corpus.meta.surah}
        />
      );

    case "ready":
      return (
        <AyatNav
          rows={rowsFor(corpus, state.data, now, archetype)}
          surah={corpus.meta.surah}
        />
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
 *  surface trusts. ATOMIC keeps BOTH kinds — `buildProgressRows` already
 *  emits them in `expand()` order (ayah, seam, ayah, …), so no re-sorting is
 *  needed to get the interleaved reading-order list the macro panel's own
 *  comment promises. Every other archetype stays ayah-only: its ring
 *  diagram already shows every seam, and this list is not a second,
 *  competing rendering of the same joints. */
function rowsFor(
  corpus: Corpus,
  events: LocalEventRow[],
  now: number,
  archetype: MacroArchetype,
): ProgressRow[] {
  const atoms = rebuild(events);
  const rows = buildProgressRows({ corpus, atoms, events, now });
  return archetype === "ATOMIC" ? rows : rows.filter((r) => r.kind === "ayah");
}

function AyatNav({ rows, surah }: { rows: ProgressRow[]; surah: number }) {
  return (
    <nav aria-label={`Ayat of surah ${surah}`}>
      {rows.map((row) =>
        row.kind === "seam" ? (
          <SeamRow key={row.id} row={row} />
        ) : (
          <Link
            key={row.id}
            href={`/surah/${surah}/${row.ayah}`}
            className="row-link"
            data-kind="ayah"
          >
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
        ),
      )}
    </nav>
  );
}

/** A joint between two ayat (edge case #90). Never a link — a seam has no
 *  detail route of its own (E-08) — but still a real mark in the memory
 *  graph, carrying the same stage badge an ayah row does rather than a bare
 *  divider. */
function SeamRow({ row }: { row: ProgressRow }) {
  return (
    <div className="row-link" data-kind="seam">
      <span>
        Joint <span className="ltr-island">{row.reference}</span>
      </span>
      <StageBadge
        stage={row.stage}
        stageLabel={row.stageLabel}
        strengthPct={row.strengthPct}
        valueLabel={row.strengthLabel}
      />
    </div>
  );
}
