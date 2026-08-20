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
import type { SessionMode } from "@/lib/session/run";
import { parseDrillParams, type DrillSpec } from "@/lib/drill/handoff";

// v3-D108 — FR9's 2-minute floor session gets its own MODE on this SAME
// route, `?mode=floor`, rather than a second `/session` page: the quiz loop,
// its commit-before-paint discipline and its four render shapes are all
// identical between a floor session and the ordinary one — only WHICH queue
// `lib/session/run.ts` builds differs, and that decision already lives
// there, never here (clause 5). Any value other than the literal "floor"
// (including a garbage query string) falls back to the ordinary session,
// same discipline edge case #78's route-param validation already uses
// elsewhere in this app.
function parseMode(raw: string | undefined): SessionMode {
  return raw === "floor" ? "floor" : "full";
}

// The header copy for the session, chosen by what it is. A drill says what it
// covers and whether it can be damaged; a floor session and the ordinary daily
// session keep their own words. `parseDrillParams` decides drill-vs-not.
function heading(mode: SessionMode, drill: DrillSpec | null): { title: string; caption: string } {
  if (drill) {
    const victory = drill.mode === "victory-lap";
    return {
      title: victory ? "Victory lap" : "Drill",
      caption: victory
        ? "Run the stretch you chose. Nothing can be damaged — this is a victory lap."
        : "Run the stretch you chose, graded as an ordinary review.",
    };
  }
  if (mode === "floor") {
    return {
      title: "Quick check-in",
      caption: "The smallest useful session — one or two items, about two minutes.",
    };
  }
  return {
    title: "Session",
    caption: "Today's mix — gates, reviews, and one new ayah if yesterday's passed.",
  };
}

export default async function SessionPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    drill?: string;
    from?: string;
    to?: string;
    page?: string;
    grade?: string;
  }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  // A drill request (`?drill=range|page`) takes precedence over `mode`: it is a
  // different, learner-chosen queue entirely (`startDrillSession`), not a
  // variant of the daily assembly. `null` when this is an ordinary session.
  const drill = parseDrillParams(sp);
  const { title, caption } = heading(mode, drill);

  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>{title}</h1>
          <p className="caption">{caption}</p>
        </header>

        <section className="card" aria-labelledby="drill-h">
          <div className="card-header">
            <h2 id="drill-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              THE DRILL
            </h2>
          </div>
          <SessionGate mode={mode} drill={drill} />
        </section>
      </div>
    </div>
  );
}
