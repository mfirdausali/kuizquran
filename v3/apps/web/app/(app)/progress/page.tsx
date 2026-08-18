// "/progress" — RETENTION MONITORING (WIREFRAME §10).
//
// The tab's landing surface, and the honest one. §10's rule, which binds
// everything built here:
//
//   "these are the SAME NUMBERS the scheduler uses, read straight off the
//    atom's stability. Nothing is decorative. An app that shows a green
//    dashboard while its own scheduler thinks the learner is lapsing has lied
//    to them."
//
// Deliberately ABSENT, permanently: streak as the hero metric, "97% done!"
// while three ayat have lapsed, guilt copy on a missed day, leaderboards.
// `streak.ts` exists and is never the headline.
//
// A SERVER COMPONENT. Every number on the finished page is log-derived and so
// arrives through client islands (edge case #72). Nothing log-derived is
// computed in this file — a server render has no IndexedDB, so anything folded
// here would paint zeros that React then keeps in production.
//
// ---------------------------------------------------------------------------
// WHAT LANDED, AND THE ONE THING THAT DID NOT
// ---------------------------------------------------------------------------
// Landed: the half-life headline, decay made visible, the band distribution,
// and honest slippage — all in `lib/progress/retention.ts`, all read from the
// same engine functions the scheduler uses.
//
// NOT landed, and deliberately still a StubNote: the PER-SURAH breakdown and
// the COMBINED LOAD view. Those are §10's "one genuine v3 extension", and the
// blocker is no longer the corpus — `lib/corpus/load.ts` now reads the FROZEN
// compiled artifact for the whole launch set (`AVAILABLE_SURAHS = [12, 67,
// 103, 112]`, HANDOVER.md's §A-note fix) — it is the ENROLLMENT MODEL.
// `meta.onboardingChoices.surah` is a single number, there is no enrollment
// list, and there is no enroll event type, so this page (like `/home` and
// `/library`) has exactly one real enrollment to report on regardless of how
// many corpora are compiled.
//
// A "per-surah breakdown" over one enrolled surah renders one row, and a
// "combined load" combines one curve. Both would be multi-surah views wearing
// the costume of one: true, green, and constraining nothing — this build's
// documented vacuous-verification failure mode, in UI form. `splitBudget()`
// (E-02/E-06's closed fix) is built and waiting; what is missing is a real
// multi-enrollment model, a product decision HANDOVER.md names as "a real
// decision, not a wiring job." So the section says what it is waiting for.

import Link from "next/link";

import { loadCorpus, AVAILABLE_SURAHS } from "@/lib/corpus/load";
import { macroFactsFor } from "@/lib/macro/facts";
import { MacroPanelIsland } from "@/components/macro/MacroPanelIsland";
import { RetentionIsland } from "@/components/progress/RetentionIsland";
import { GrowthIsland } from "@/components/progress/GrowthIsland";
import { TestHistoryIsland } from "@/components/progress/TestHistoryIsland";
import { StubNote } from "@/components/shell/StubNote";

/** Which surah this page reports on. A query param today; when a learner can
 *  enrol in several this becomes the enrolment set — which is precisely what
 *  the combined-load section is waiting for. Mirrors /progress/list's own
 *  parser so the two routes can never disagree about what "this surah" means. */
function parseSurah(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && AVAILABLE_SURAHS.includes(n) ? n : AVAILABLE_SURAHS[0]!;
}

/** The window the "since" comparison looks back over — §10's "72% -> 64% since
 *  Thursday". One week: long enough that decay is legible, short enough that
 *  the label stays a weekday name a learner remembers rather than a date. */
const SINCE_WINDOW_MS = 7 * 86_400_000;

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ surah?: string }>;
}) {
  const { surah: rawSurah } = await searchParams;
  const surah = parseSurah(rawSurah);
  const corpus = await loadCorpus(surah);

  // `now` is resolved ONCE, on the server, and passed down — so the headline,
  // the distribution and every decay line in one render decay to the same
  // instant. Reading a clock per figure would let two numbers on one card
  // disagree about what day it is.
  const now = Date.now();
  const since = now - SINCE_WINDOW_MS;
  // The same `/plan` page convention (`forecast.ts#dateLabel`'s own header):
  // resolved once, server-side, and passed down explicitly — never read from
  // the machine inside a date-formatting call.
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const facts = corpus === null ? null : macroFactsFor(corpus);

  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Progress</h1>
          {/* One .voice line per screen, maximum — the locked file's §8 rule 3.
              Every other line on this page is .caption or .stub-note. */}
          <p className="voice">
            These are the same numbers the scheduler uses. Nothing here is
            decorative.
          </p>
        </header>

        <section className="card" aria-labelledby="retention-h">
          <div className="card-header">
            <h2 id="retention-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              RETENTION
            </h2>
          </div>

          {corpus === null ? (
            // A designed unavailable state, never a card of fabricated zeros
            // for a surah we hold no text for (E-07).
            <p className="stub-note">
              No corpus is available for surah {surah} in this build, so there
              is nothing to report on yet.
            </p>
          ) : (
            <RetentionIsland corpus={corpus} now={now} since={since} />
          )}
        </section>

        <section className="card" aria-labelledby="growth-h">
          <div className="card-header">
            <h2 id="growth-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              GROWTH
            </h2>
          </div>

          {corpus === null ? (
            <p className="stub-note">
              No corpus is available for surah {surah} in this build, so there
              is nothing to report on yet.
            </p>
          ) : (
            <GrowthIsland surah={surah} />
          )}
        </section>

        {/* THE MEMORY GRAPH. The same island /surah/[surah] renders, reused
            rather than re-wired: it already owns the two-prop split (server
            `facts`, client-derived `nodes`) that keeps edge case #72 out, and a
            second ring wiring would be a second place for that split to be got
            wrong. It draws ayat AND seams via buildGraphNodes/expand, so the
            connection atoms that are ~40% of a short surah are peers of the
            ayat rather than unrendered (edge case #90). */}
        {facts !== null && corpus !== null && (
          <MacroPanelIsland
            surah={surah}
            ayahCount={corpus.meta.ayahCount}
            facts={facts}
          />
        )}

        <section className="card" aria-labelledby="load-h">
          <div className="card-header">
            <h2 id="load-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              COMBINED LOAD
            </h2>
          </div>
          <StubNote step="step 10 (M5), WIREFRAME §10">
            With N surahs there are N independent decay curves competing for one
            budget, and without this view a learner adds a third surah and
            silently starves the first two. This build can serve one surah, so a
            per-surah breakdown would render a single row and a combined load
            would combine a single curve. The splitting mechanism (E-02/E-06) is
            already built; this section lands when a second corpus does.
          </StubNote>
        </section>

        <section className="card" aria-labelledby="alt-h">
          <div className="card-header">
            <h2 id="alt-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              EVERY AYAH
            </h2>
          </div>
          <p className="caption">
            The ring and the heatmap are pictures. This list is the same
            information as text — searchable, sortable, and the documented text
            alternative to the ring (§15).
          </p>
          <Link href="/progress/list" className="btn hit">
            Open the full list
          </Link>
        </section>

        {/* v2 Phase 4 (v2-D13..D16), v3-D103's own named deferral: a
            self-initiated mixed quiz, read-only by construction (rebuild.ts
            has no fold branch for any test_* event — invariant #5). Entry
            point lives here, beside the numbers it never moves, rather than
            in the locked 4-tab bar (v3-D05 closes that bar at four). */}
        <section className="card" aria-labelledby="test-cta-h">
          <div className="card-header">
            <h2 id="test-cta-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              TEST
            </h2>
          </div>
          <p className="caption">
            A mixed self-check over ayat you choose. It never moves your
            progress.
          </p>
          <Link href="/test" className="btn hit">
            Take a Test
          </Link>
        </section>

        {/* v2-D17 Progress Report's own "Test history" list — v3-D104's own
            named deferral, closed here (v3-D105): `test.ts#testHistory` reads
            durable `test_result` events off the log; this card is the first
            thing that ever renders them. */}
        <section className="card" aria-labelledby="test-history-h">
          <div className="card-header">
            <h2 id="test-history-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              TEST HISTORY
            </h2>
          </div>

          {corpus === null ? (
            <p className="stub-note">
              No corpus is available for surah {surah} in this build, so there
              is nothing to report on yet.
            </p>
          ) : (
            <TestHistoryIsland surah={surah} tz={tz} />
          )}
        </section>
      </div>
    </div>
  );
}
