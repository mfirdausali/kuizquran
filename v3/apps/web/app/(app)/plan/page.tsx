// "/plan" — THE PLAN CALENDAR (WIREFRAME §14, v3-D05).
//
// v3-D05 (2026-08-10): the calendar is no longer a forecast readout buried
// inside the surah page. It is ITS OWN ROUTE and ITS OWN TAB, replacing "You"
// in the bottom bar.
//
//   "Calendar is a must to ensure predictability."
//
// Predictability is a product promise, and a promise needs a surface. That is
// the whole argument for this tab existing, and it is why the account surface
// (§24) lost its permanent quarter of the navigation to it.
//
// A SERVER COMPONENT. The forecast is log-derived and arrives through a client
// island (edge case #72) — a server render has no log, and a confident
// calendar built from zero events is a worse lie than a skeleton.
//
// THE HONESTY MECHANIC — confidence decays with distance. Reviews are
// generated from measured decay, so far-future days genuinely CANNOT be known.
// Rather than fake precision, the UI shows its own confidence dropping across
// three fidelity zones:
//
//   today → +3d   CONCRETE     exact items: "gate ayah 13, 6 reviews, learn 14"
//   +4d → +14d    ESTIMATED    load only: "~9 min, ~11 items". Kinds, not ayat.
//   +15d → end    TRAJECTORY   just the shape: "~8 min/day, finishing mid-March"
//
// Why this is not a cop-out: populating every future day with specific ayat
// would look more satisfying and would be a LIE — a review three weeks out
// depends on how the next twenty sessions actually go. Inventing that
// precision breaks the same contract as §10's retention numbers. The learner
// still gets predictability, because the COMMITMENT is stable (~8 min/day, one
// new ayah) even when the item list is not. Predictable effort, honest detail.
//
// ---------------------------------------------------------------------------
// SHOWN, NOT ASSERTED
// ---------------------------------------------------------------------------
// The legend below still exists, because naming the three zones up front is
// useful. But a legend is an ASSERTION, and the mechanic cannot live in it.
// The test is: COVER THE LEGEND — can you still tell the zones apart? Five
// devices in <PlanCalendar> answer yes, and none of them is colour: the rows
// are structurally different objects (a list, then one line, then no day rows
// at all), the numeric precision degrades visibly, each zone says its fidelity
// as a word, each boundary carries one sentence of why, and a hairline seam
// makes the transition a place on the page.
//
// ---------------------------------------------------------------------------
// E-06 IS CLOSED, WHICH IS WHY A FINISH DATE MAY BE SHOWN AT ALL
// ---------------------------------------------------------------------------
// E-06 ("planFor() gives every surah the full daily budget — every ETA lies")
// was closed at build-plan step 9 by `multiSurah.ts#splitBudget()`. The
// forecast builder is a CALLER of it: every `planFor` call receives a split
// share, never the raw total. Were that not so, this page would have to omit
// the finish clause entirely — shipping a date you know is wrong is the exact
// failure §14 exists to prevent.

import { loadCorpus, AVAILABLE_SURAHS } from "@/lib/corpus/load";
import { PlanIsland } from "@/components/plan/PlanIsland";

/** The three fidelity zones, §14. Kept as the page's own legend — it names
 *  what the calendar below then DEMONSTRATES structurally. */
const ZONES = [
  {
    id: "concrete",
    horizon: "Today → +3 days",
    fidelity: "Concrete",
    shown: "Exact items — which gate, how many reviews, which ayah is new.",
  },
  {
    id: "estimated",
    horizon: "+4 → +14 days",
    fidelity: "Estimated",
    shown: "Load only — roughly how long and how many items. Kinds, not ayat.",
  },
  {
    id: "trajectory",
    horizon: "+15 days → the end",
    fidelity: "Trajectory",
    shown: "The shape — minutes per day, and roughly when you finish.",
  },
] as const;

/** The Steady pace budget (pace.ts). Persisting a learner's chosen mode is
 *  M6's schema work (E-05 is explicitly a storage question, not an engine
 *  one), so the default is used and named rather than silently assumed. */
const STEADY_MINUTES_PER_DAY = 8;

export default async function PlanPage() {
  const surah = AVAILABLE_SURAHS[0]!;
  const corpus = await loadCorpus(surah);

  // Resolved once on the server so every zone in one render measures from the
  // same instant. `tz` is passed explicitly down the whole chain — the engine
  // is pure and never reads the machine's zone, and neither does this page.
  const now = Date.now();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Plan</h1>
          <p className="voice">
            Predictable effort, honest detail. We never invent a precision the
            schedule does not have.
          </p>
        </header>

        <section className="card" aria-labelledby="fidelity-h">
          <div className="card-header">
            <h2 id="fidelity-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              HOW FAR AHEAD WE CAN SEE
            </h2>
          </div>
          <div className="stack stack--tight">
            {ZONES.map((zone) => (
              <div key={zone.id} className="row-link" style={{ cursor: "default" }}>
                <span>
                  <strong>{zone.horizon}</strong>
                  <br />
                  <span className="caption">{zone.shown}</span>
                </span>
                {/* The fidelity is a WORD, not a colour or an opacity ramp
                    (§15: never colour alone). */}
                <span className="stage-label">
                  <span className="stage-label__name">{zone.fidelity}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card" aria-labelledby="cal-h">
          <div className="card-header">
            <h2 id="cal-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              CALENDAR
            </h2>
          </div>
          {corpus === null ? (
            <p className="stub-note">
              No corpus is available in this build, so there is nothing to plan
              against yet.
            </p>
          ) : (
            <PlanIsland
              corpus={corpus}
              now={now}
              tz={tz}
              minutesPerDay={STEADY_MINUTES_PER_DAY}
            />
          )}
        </section>
      </div>
    </div>
  );
}
