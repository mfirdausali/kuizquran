// "/session" — THE QUIZ LOOP (WIREFRAME §5).
//
// ---------------------------------------------------------------------------
// THIS ROUTE WAS A STUB FOR EIGHT BUILD-PLAN STEPS (v3-D67)
// ---------------------------------------------------------------------------
// The render layer landed at step 18 and was well tested — 47 tests over the
// four closed shapes, built from real engine output. What never landed was the
// LIFECYCLE that feeds them, so `append()` had zero reachable callers and the
// event log that invariant #2 calls "the truth" was never written by any
// interaction a learner could reach. The suite was green throughout, because
// every test asked about a component and none asked whether a learner could
// finish a session.
//
// The stub that stood here listed its own blockers. Two of them had since been
// resolved elsewhere and the note went stale: `lib/corpus/client.ts` is the
// corpus loader it said did not exist, and `lib/onboarding/pass.ts` is the
// shared assembly. What genuinely remained was the loop, which now lives in
// `lib/session/run.ts` and is driven by `components/session/SessionIsland.tsx`.
//
// ---------------------------------------------------------------------------
// WHY THE ORCHESTRATION IS NOT IN THIS FILE
// ---------------------------------------------------------------------------
// The engine decides what to serve; this view never does. `assembleQueue`, any
// strength comparison and any band test are forbidden under `app/` and
// `components/` by `check-boundaries.mjs` clause 5 — which is what makes
// DEFECTS.md#B2 impossible by construction rather than merely fixed once. This
// route therefore does exactly one thing: read the enrollment and hand it down
// as data.

import { SessionGate } from "@/components/session/SessionGate";

export default function SessionPage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Session</h1>
          <p className="caption">
            Today&apos;s mix — gates, reviews, and one new ayah if yesterday&apos;s
            passed.
          </p>
        </header>

        <section className="card" aria-labelledby="drill-h">
          <div className="card-header">
            <h2 id="drill-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              THE DRILL
            </h2>
          </div>
          <SessionGate />
        </section>
      </div>
    </div>
  );
}
