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
// NOW LANDED — the due count and the route into today's work.
//
// The note that stood here said a due count had to wait because "until
// `assembleQueue` runs against rebuilt atoms there is no honest due count to
// show". `lib/session/run.ts` now runs exactly that pipeline for the session
// loop, so the number exists. What made it safe to show is that /home takes it
// from THE SAME assembly the session will serve (`assembleFor`), rather than
// from a second, cheaper approximation beside it — a dashboard that says "5
// due" and then hands over a session of 3 is the dishonesty the boundary
// exists to prevent, and two assemblies is the shape in which that happens.
//
// The count is DECIDED in `lib/home/queue.ts` and arrives here as a written
// sentence. It could not be computed in this tree even by accident:
// check-boundaries.mjs clause 5 matches the TOKEN `assembleQueue`, so the
// import line alone would fail the build (DEFECTS.md#B2).
//
// The CTA honours §12 rather than its wording. §12's rule is that there is no
// "Continue" when there is nothing to continue — so the CTA renders only when
// the queue is non-empty, and it names what it STARTS ("Start today's
// session") rather than saying "Continue", which describes nothing.
//
// STILL OPEN:
//   - MULTI-surah rows. WIREFRAME §1 says MY SURAHS is plural with N
//     independent schedules, but the enrollment this build writes is SINGULAR
//     (`readChoices()` returns one `surah`), and there is no enrollment list to
//     read. Listing surahs a learner never enrolled in would be a fabricated
//     enrollment, which is worse than a short list, so what ships is the one
//     real enrollment rendered honestly.
//   - The recommender card proper (build-plan step 30 — last, and deliberately
//     so). MySurahs' zero state stands in with the honest subset: the surahs
//     this build can actually teach.

import Link from "next/link";
import { MySurahs } from "@/components/home/MySurahs";
import { DeviceReset } from "@/components/home/DeviceReset";
import { StubNote } from "@/components/shell/StubNote";
import { SyncStatus } from "@/components/shell/SyncStatus";
import { TodaySession } from "@/components/home/TodaySession";

export default function HomePage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Home</h1>
          <p className="caption">Your surahs, and what is due today.</p>
          {/* v3-D05 / TabBar's own header: the account surface costs a tap
              from here rather than a permanent tab. */}
          <p className="caption">
            <Link href="/settings">Account &amp; data settings</Link>
          </p>
        </header>

        {/* TODAY comes FIRST. The dashboard's job is to answer "what do I do
            now", and an enrolled learner should not have to read past their
            history to find it. */}
        <section className="card" aria-labelledby="today-h">
          <div className="card-header">
            <h2 id="today-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              TODAY
            </h2>
          </div>
          {/* The due count and the CTA. A client island for the reason this
              file's header gives — the schedule is derived from the LOG, and a
              server render has no log, so an RSC would paint "nothing due" to
              a learner who has four items (#72). */}
          <TodaySession />
        </section>

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

        <StubNote step="step 30, WIREFRAME §1">
          MULTIPLE surahs, each with its own schedule. The enrollment this build
          writes holds one surah, so TODAY shows the one that is real rather
          than listing surahs nobody enrolled in. The recommender card is step
          30; MySurahs&apos; zero state stands in with the honest subset.
        </StubNote>
      </div>
    </div>
  );
}
