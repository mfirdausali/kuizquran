// "/test" — v2 Phase 4 (v2-D13..D16): a self-initiated, READ-ONLY mixed quiz
// over a learner-chosen range. v3-D103's own named deferral, closed here.
//
// `packages/engine/src/test.ts` reuses the SAME generators the Learn ladder
// already uses (invariant #6) — this route's only job, mirroring every other
// route in `(app)/`, is to read the enrollment and hand it down as data. It
// makes no selection, grading, or scheduling decision itself.

import { TestGate } from "@/components/test/TestGate";

export default function TestPage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Test</h1>
          <p className="caption">
            A mixed self-check over ayat you choose. It never moves your
            progress — reviews and gates are unaffected either way.
          </p>
        </header>

        <section className="card" aria-labelledby="test-h">
          <div className="card-header">
            <h2 id="test-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              SELF-CHECK
            </h2>
          </div>
          <TestGate />
        </section>
      </div>
    </div>
  );
}
