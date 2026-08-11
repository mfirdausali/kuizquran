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
// A SERVER COMPONENT. The forecast is log-derived and arrives through client
// islands (edge case #72).
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
// TODO(build-plan step 11 → M5, WIREFRAME §14):
//   - `planFor()` projected onto real dates, in the three fidelity zones
//     above, each zone VISIBLY different so the drop in confidence is legible
//     rather than hidden.
//   - Fix E-06 first: `planFor()`'s etaDays uses one surah's remaining ayat
//     against the FULL daily budget, so every surah's ETA claims the whole
//     day. Divide the budget by active surahs.
//   - Measured pace, active days, re-forecast every session.
//   - PLANNED ABSENCES: any future day can be marked away — travel, exams,
//     illness — and the forecast adjusts honestly instead of scoring it a
//     miss. The alternative teaches learners that the calendar punishes life.

import { StubNote } from "@/components/shell/StubNote";

/** The three fidelity zones, §14. Rendered as the page's own structure so the
 *  honesty mechanic is visible in the shell before the data exists. */
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

export default function PlanPage() {
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
          <StubNote step="step 11 (M5), WIREFRAME §14">
            planFor() projected onto real dates across the three fidelity
            zones, measured pace, re-forecast every session, and planned
            absences — mark a day away and the forecast adjusts instead of
            scoring it a miss. Fix E-06 first: today every surah&apos;s ETA
            claims the whole daily budget.
          </StubNote>
        </section>
      </div>
    </div>
  );
}
