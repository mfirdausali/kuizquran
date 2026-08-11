// "/home" — THE DASHBOARD (v3-D14; WIREFRAME §1).
//
// v3-D14: "/" is the landing page, "/home" is the dashboard, and the PWA's
// start_url is /home. This is where an onboarded learner lands, every time.
//
// This page is a SERVER COMPONENT. Everything log-derived is delegated to a
// client island (<LogSummary/>) — see edge case #72: a server render has no
// log, so an RSC that read one would paint 0 while the client hydrates the
// real number. check-boundaries.mjs clause 2 fails the build if this file ever
// imports lib/idb without "use client".
//
// TODO(build-plan step 20 / M6, WIREFRAME §1): the real dashboard.
//   - MY SURAHS: per-surah rows with independent schedules, rendered from the
//     event log + a small MANIFEST — never N corpus fetches (edge case E-07).
//   - The Continue CTA, and its ABSENCE in the zero state (§12): no "Continue"
//     when there is nothing to continue.
//   - Due counts per surah, arriving as DATA from the engine. Band and
//     strength comparisons may NEVER appear in this JSX — check-boundaries.mjs
//     clause 5 enforces it (DEFECTS.md#B2).
//   - The recommender card (build-plan step 30 — last, and deliberately so).
//   - Make-up messaging after a genuinely skipped day (resumePolicy → makeup).

import Link from "next/link";
import { LogSummary } from "@/components/home/LogSummary";
import { StubNote } from "@/components/shell/StubNote";
import { SyncStatus } from "@/components/shell/SyncStatus";

export default function HomePage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Home</h1>
          <p className="caption">Your surahs, and what is due today.</p>
        </header>

        <section className="card" aria-labelledby="my-surahs-h">
          <div className="card-header">
            <h2 id="my-surahs-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              MY SURAHS
            </h2>
          </div>
          {/* The log-derived line. A client island, exhaustively three-stated. */}
          <LogSummary />
          {/* #103's quiet "N pending" indicator (build-plan step 21 / M6). A
              PASSIVE OBSERVER: it reads a count, it never triggers or awaits a
              flush, and no session path reads it. Three-stated like every other
              log read, so a not-yet-read count paints a skeleton, never `0`. */}
          <SyncStatus />
          <Link href="/library" className="btn hit">
            Browse the library
          </Link>
        </section>

        <StubNote step="step 20 (M6), WIREFRAME §1">
          MY SURAHS rows with per-surah due counts, the Continue CTA (and its
          absence in the zero state), make-up messaging, and the recommender
          card. Due counts arrive from the engine as data — no band or strength
          logic ever enters this view.
        </StubNote>
      </div>
    </div>
  );
}
