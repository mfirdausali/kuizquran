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
// BUILD-PLAN STEP 22 landed here: the ZERO STATE (#97), the RETURNING-AFTER-
// WEEKS message (#98) and the DEVICE RESET enumeration (#104). Each is a client
// island for the reason this file's header gives — they are log-derived, and a
// server render has no log.
//
// STILL OPEN (they need the engine wired to the log, which is not this step):
//   - Per-surah rows with independent schedules and DUE COUNTS. These must
//     arrive as DATA from the engine; band and strength comparisons may NEVER
//     appear in this JSX — check-boundaries.mjs clause 5 enforces it
//     (DEFECTS.md#B2). Until `assembleQueue` runs against rebuilt atoms there is
//     no honest due count to show, and a fabricated one is the exact
//     retention-honesty violation the whole boundary exists to prevent.
//   - The Continue CTA. Deliberately absent in the zero state (§12) — and
//     absent everywhere else in this build too, because "Continue" that starts
//     nothing is worse than no button.
//   - The recommender card proper (build-plan step 30 — last, and deliberately
//     so). MySurahs' zero state stands in with the honest subset: the surahs
//     this build can actually teach.

import { MySurahs } from "@/components/home/MySurahs";
import { DeviceReset } from "@/components/home/DeviceReset";
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
          {/* #97's zero state (leads with somewhere to go, never an empty box)
              and #98's returning-after-weeks message. A client island,
              exhaustively four-stated. */}
          <MySurahs />
          {/* #103's quiet "N pending" indicator (build-plan step 21 / M6). A
              PASSIVE OBSERVER: it reads a count, it never triggers or awaits a
              flush, and no session path reads it. Three-stated like every other
              log read, so a not-yet-read count paints a skeleton, never `0`. */}
          <SyncStatus />
        </section>

        {/* #104: a destructive action must enumerate what it would destroy
            BEFORE it is offered — "N surahs", not "some data". */}
        <section className="card" aria-labelledby="device-h">
          <div className="card-header">
            <h2 id="device-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              THIS DEVICE
            </h2>
          </div>
          <DeviceReset />
        </section>

        <StubNote step="step 22 → M6/M7, WIREFRAME §1">
          Per-surah rows with due counts and the Continue CTA. Both wait on the
          engine running against the rebuilt log — a due count invented in this
          view would be the exact dishonesty the boundary exists to prevent.
        </StubNote>
      </div>
    </div>
  );
}
