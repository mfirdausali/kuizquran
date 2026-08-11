// "/session" — THE QUIZ LOOP (WIREFRAME §5).
//
// The drill: tap-to-reconstruct, the chain check, and the session summary.
// The full lifecycle is create -> drill -> summary -> completion celebration
// -> quit/resume.
//
// STATUS after build-plan step 18. The RENDER LAYER is built and tested; the
// SESSION LIFECYCLE that feeds it is not, so this route is still a stub.
//
// WHAT LANDED (step 18) — `components/quiz/`:
//   - `QuizCard`, the dispatcher, switching on `item.shape` and NOTHING else,
//     exhaustive over the four closed shapes with a `never`-typed default (a
//     fifth shape is a COMPILE error here, not a runtime surprise).
//   - `ChoiceCard` / `SequenceFillCard` / `OrderTilesCard` / `LocateChoiceCard`,
//     one per shape, each consuming the engine's `RenderItem` verbatim.
//   - `FaceText`, the single place `script: "arabic"` becomes `dir="rtl"
//     lang="ar"` with bidi isolation (#80). No Arabic is written anywhere; every
//     glyph arrives at runtime inside a `Face` built by `faces.ts#buildFace`.
//   - RTL taps map to the LOGICAL index, never the visual mirror (#81) —
//     mutation-tested: introducing the classic `length - 1 - i` flip turns
//     seven tests red, including one asserting the tapped tile's TEXT matches
//     the Face at the reported index.
//   - 47 render tests in `test/quiz.test.tsx`, built from REAL engine output
//     (`buildQuestion` against the 12.json fixture) rather than hand-written
//     items, so a drift in the render contract breaks them.
//
// WHAT IS STILL MISSING — the lifecycle, which is why this page is a stub:
//   - A CORPUS LOADER. There is no server-side corpus read in this app yet, so
//     nothing can produce a `RenderItem` at request time. The components are
//     ready and take one as a prop; the supply is not built. Deliberately NOT
//     invented here — a loader guessed at now is a loader the corpus pipeline
//     has to unpick later.
//   - COMMIT BEFORE PAINT (invariant #2): the tap is appended to the log and
//     `tx.done` is AWAITED before the UI animates. A crash mid-session loses
//     nothing. Never animate optimistically and reconcile later. The components
//     are built for this: they NEVER grade their own tap — they report which
//     index was tapped and paint a verdict only when the caller passes one back
//     down as `reveal`, which the caller may only do after the write lands.
//   - Session create/resume/summary, bfcache resume via `pageshow` re-reading
//     the session row (edge case #93), and the surah-completion celebration —
//     the app's biggest emotional beat, its own distinct state (WIREFRAME §12).
//
// The engine decides what to serve. This view NEVER does.
//
// The engine decides what to serve. This view NEVER does: no strength
// comparison, no band logic, no assembleQueue, no unlockPermitted in JSX.
// check-boundaries.mjs clause 5 fails the build on any of them — which is what
// makes DEFECTS.md#B2 impossible by construction rather than merely fixed.

import { StubNote } from "@/components/shell/StubNote";

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
          <StubNote step="step 19 (M5), WIREFRAME §5 + §22">
            The four closed render shapes are built and tested (see{" "}
            <code>components/quiz/</code>). What is still missing here is the
            supply and the lifecycle: a corpus loader to produce a{" "}
            <code>RenderItem</code> at request time, commit-before-paint on
            every tap, and the session lifecycle through to the
            surah-completion celebration. The queue arrives already assembled
            — this view never decides.
          </StubNote>
        </section>
      </div>
    </div>
  );
}
