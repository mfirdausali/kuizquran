"use client";

// "HOW WELL YOU HOLD IT" — the per-ayah stats block on /surah/[surah]/[ayah]
// (WIREFRAME §4 + §15).
//
// ---------------------------------------------------------------------------
// WHY THIS IS A CLIENT ISLAND AND NOT PART OF THE PAGE
// ---------------------------------------------------------------------------
// Edge case #72, in its sharpest form. Half-life, strength, next-review and
// time-on-task are ALL log-derived, and a server render has no IndexedDB. The
// page would paint "0%" and "—" for every field; the client would then hydrate
// the real values; and in PRODUCTION React silently keeps the server's markup.
// A learner who has carried this ayah for six weeks is shown a page saying they
// have never touched it — and WIREFRAME §10 is explicit that the numbers shown
// must be the numbers the scheduler uses. check-boundaries.mjs clause 2 makes
// the split structural: this file owns the `lib/idb` import and the "use
// client" that legitimises it, and the page imports only the component.
//
// ---------------------------------------------------------------------------
// WHAT THIS COMPONENT DECIDES: NOTHING
// ---------------------------------------------------------------------------
// Every value it paints is already a STRING when it arrives: `halfLifeLabel`
// ("9.4 days"), `nextLabel` ("in 3 days"), `timeOnTask` ("2m 14s"),
// `strengthLabel` ("48%" or "—"), `stageLabel` ("Carrying"). All of them are
// built in lib/progress/rows.ts, which is where DEFECTS.md#B2's "a half-life
// computed in JSX" is made impossible. There is no arithmetic below, no
// comparison, and no lookup table — the row is printed, not interpreted.
//
// THE STAGE goes through StageBadge, the ONLY stage renderer in the app
// (edge case #87). An inline dot here would be exactly the drift that
// resolution exists to prevent.
//
// ---------------------------------------------------------------------------
// FOUR STATES, EXHAUSTIVELY — edge case #73
// ---------------------------------------------------------------------------
//   pending — SKELETONS. Never the digit 0, never "—". A pending read that
//             paints 0 is the same lie as an SSR'd 0, and "—" is a CLAIM
//             (this atom is unmeasured), not an absence of one.
//   empty   — a REAL answer for a new learner, not a missing one. Fold zero
//             events and print the honest row: "Not started", "—", "—". The
//             block still appears, because "you have not started this yet" is
//             information the learner came for.
//   ready   — the row.
//   broken  — say so, and name the reason. A silent fall-back to the empty
//             state would be indistinguishable from `empty` — i.e. a lie about
//             a failure.
//
// ---------------------------------------------------------------------------
// THE JOINT IS SHOWN TOO (edge case #90 at single-ayah zoom)
// ---------------------------------------------------------------------------
// A per-ayah view is the single most likely place for the connection atoms to
// disappear: nothing about "ayah 4" obviously implies "the joint out of 4".
// But v3-D03's whole model is that knowing 3 and knowing 4 does not mean you
// can go 3→4, and a page that reported only the ayah's own strength would hide
// precisely the atom the learner is failing. So the joint leaving this ayah is
// rendered beside it — absent only at the last ayah, where `expand()` never
// constructs one (E-08, by construction, not by a bound check here).

import { useCallback } from "react";

import { rebuild } from "@engine/rebuild.ts";
import { wordDiagnostics } from "@engine/heatmap.ts";
import type { Corpus } from "@engine/types.ts";
import { getEventsForSurah, useLogState } from "@/lib/idb";
import type { LocalEventRow, LogState } from "@/lib/idb";
import {
  ayahRow,
  buildProgressRows,
  seamRowFrom,
  type ProgressRow,
} from "@/lib/progress/rows";
import { buildWordAccuracyRows, type WordAccuracyRow } from "@/lib/progress/wordAccuracy";
import { StageBadge } from "./StageBadge";

export interface AyahStatsIslandProps {
  /** Corpus is server: it arrives as a prop, already loaded and identical for
   *  every learner. Only the LOG is read here. */
  corpus: Corpus;
  ayah: number;
  /** Captured ONCE on the server and passed down, so every figure in one render
   *  decays to the same instant. A clock read per field would let the half-life
   *  and the next-review disagree about what day it is. */
  now: number;
}

export function AyahStatsIsland({ corpus, ayah, now }: AyahStatsIslandProps) {
  const surah = corpus.meta.surah;

  // Stable identity: an inline arrow is a new function every render and the
  // effect would re-run forever.
  const selector = useCallback(() => getEventsForSurah(surah), [surah]);
  // What "empty" means for THIS selector, stated explicitly — the hook refuses
  // a truthiness default because `0` and `[]` are legitimate VALUES elsewhere.
  const isEmpty = useCallback((rows: LocalEventRow[]) => rows.length === 0, []);

  const state = useLogState<LocalEventRow[]>(selector, isEmpty, [surah]);

  return <AyahStatsView state={state} corpus={corpus} ayah={ayah} now={now} />;
}

/**
 * THE STATE → VIEW MAPPING, as a pure component.
 *
 * Split out of the island — and EXPORTED — for one reason: it is the part that
 * can be wrong. A test that only scans this file's source for the word
 * "StatsSkeleton" asserts that a skeleton EXISTS, not that `pending` renders
 * it, and that distinction is the whole of edge case #73. (Learned the hard
 * way: collapsing `pending` into the empty branch — which paints "Not started"
 * and "—" at a learner who may well be carrying this ayah — left the whole
 * suite green when the only coverage was a source scan.)
 *
 * With the hook lifted out, a test can hand this component each of the four
 * LogStates and read what a learner would actually see.
 */
export function AyahStatsView({
  state,
  corpus,
  ayah,
  now,
}: {
  state: LogState<LocalEventRow[]>;
  corpus: Corpus;
  ayah: number;
  now: number;
}) {
  switch (state.status) {
    case "pending":
      // SKELETONS, NEVER ZEROS, and never "—" either. "—" is a CLAIM — it says
      // this atom is unmeasured — and while the read is still in flight we do
      // not know that. The only honest render is one that claims nothing.
      return <StatsSkeleton />;

    case "empty":
      // A DESIGNED zero-state, not a missing one. The row is real — built by
      // folding zero events — so it reads "Not started" / "—", which is the
      // truth for a learner who has never opened this ayah.
      return <StatsBody {...rowsFor(corpus, [], now, ayah)} />;

    case "ready":
      return <StatsBody {...rowsFor(corpus, state.data, now, ayah)} />;

    case "broken":
      return (
        <div className="banner banner--warn" role="alert">
          <p>Your progress for this ayah could not be read on this device.</p>
          <p className="sub">
            Reason: <code>{state.reason}</code>. Nothing has been lost — the log
            is append-only and re-readable once storage recovers.
          </p>
        </div>
      );
  }
}

/** Skeletons, never zeros (#73). The SHAPE of the block is painted so the
 *  layout does not jump on resolve, but not one number is claimed. */
function StatsSkeleton() {
  return (
    <div className="stack stack--tight" aria-busy="true">
      <p className="caption">
        <span className="skel" aria-hidden="true" /> reading your progress…
      </p>
      <dl className="stat-grid" aria-hidden="true">
        {["Stage", "Half-life", "Next review", "Time on task"].map((label) => (
          <div className="stat" key={label}>
            <dt>{label}</dt>
            <dd>
              <span className="skel" />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface StatsBodyProps {
  row: ProgressRow | undefined;
  seam: ProgressRow | undefined;
  ayah: number;
  surah: number;
  wordAccuracy: WordAccuracyRow[];
}

function StatsBody({ row, seam, ayah, surah, wordAccuracy }: StatsBodyProps) {
  // An ayah outside this surah's range. A designed state, never a fabricated
  // set of zeros for an atom that does not exist.
  if (!row) {
    return (
      <p className="stub-note">
        Surah {surah} has no ayah {ayah}, so there is nothing to report on.
      </p>
    );
  }

  return (
    <div className="stack stack--tight">
      <dl className="stat-grid">
        <div className="stat">
          <dt>Stage</dt>
          <dd>
            {/* The ONLY stage renderer in the app (#87). `strengthLabel` is
                passed as the value because "0%" and "unmeasured" are different
                facts and only the row builder knows which one this is. */}
            <StageBadge
              stage={row.stage}
              stageLabel={row.stageLabel}
              strengthPct={row.strengthPct}
              valueLabel={row.strengthLabel}
            />
          </dd>
        </div>
        <div className="stat">
          <dt>Half-life</dt>
          <dd>{row.halfLifeLabel}</dd>
        </div>
        <div className="stat">
          <dt>Next review</dt>
          <dd>{row.nextLabel}</dd>
        </div>
        <div className="stat">
          <dt>Time on task</dt>
          <dd>{row.timeOnTask}</dd>
        </div>
      </dl>

      {/* THE JOINT OUT OF THIS AYAH (#90). Absent at the last ayah, where
          expand() never builds one — there is no bound check here because
          there is nothing to bound. */}
      {seam ? (
        <div className="stack stack--tight" id="seam">
          <p className="caption">
            The joint out of this ayah — going{" "}
            <span className="ltr-island">{seam.reference}</span> is its own
            memory, separate from either ayah.
          </p>
          <dl className="stat-grid">
            <div className="stat">
              <dt>Joint stage</dt>
              <dd>
                <StageBadge
                  stage={seam.stage}
                  stageLabel={seam.stageLabel}
                  strengthPct={seam.strengthPct}
                  valueLabel={seam.strengthLabel}
                />
              </dd>
            </div>
            <div className="stat">
              <dt>Joint next review</dt>
              <dd>{seam.nextLabel}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {/* TAP ACCURACY, WORD BY WORD — heatmap.ts's own "one tap deeper"
          diagnostic (invariant #1: words are diagnostics, never the graded
          atom). Only words actually tapped appear; an untouched word is
          dropped, never printed as "0%" — the same unmeasured-vs-zero rule
          rows.ts follows for the ayah figures above. */}
      {wordAccuracy.length > 0 ? (
        <div className="stack stack--tight">
          <h3 className="retention-subhead">Tap accuracy, word by word</h3>
          <ul className="stat-list">
            {wordAccuracy.map((w) => (
              <li key={w.position} className="stat-list__row">
                <span className="ltr-island">Word {w.position}</span>
                <span>{w.accuracyLabel}</span>
                <span>{w.tapsLabel}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="caption">
          No word-level taps recorded for this ayah yet — this fills in as you
          drill it.
        </p>
      )}

      <p className="caption">
        These are the same numbers the scheduler reads. Time on task counts only
        measured attempts — a session you walked away from is discarded, not
        charged to you.
      </p>
    </div>
  );
}

/** Fold the log into atoms, then into rows, then pick the two this page is
 *  about. `rebuild()` is the engine's own fold — the app never re-implements
 *  strength math, it asks for it. */
function rowsFor(
  corpus: Corpus,
  events: LocalEventRow[],
  now: number,
  ayah: number,
): StatsBodyProps {
  const atoms = rebuild(events);
  const rows = buildProgressRows({ corpus, atoms, events, now });
  return {
    row: ayahRow(rows, ayah),
    seam: seamRowFrom(rows, ayah),
    ayah,
    surah: corpus.meta.surah,
    wordAccuracy: buildWordAccuracyRows(wordDiagnostics(corpus, events, ayah)),
  };
}
