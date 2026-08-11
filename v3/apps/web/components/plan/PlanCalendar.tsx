// THE PLAN CALENDAR — WIREFRAME §14's three fidelity zones, rendered so that
// the drop in confidence is VISIBLE rather than asserted.
//
// ---------------------------------------------------------------------------
// THE TEST THIS COMPONENT IS BUILT TO PASS
// ---------------------------------------------------------------------------
// A legend that says "estimated" is an assertion. The real test is: COVER THE
// LEGEND — can you still tell the zones apart? Five devices answer yes, and
// not one of them is colour or opacity:
//
// 1. THE ROWS ARE STRUCTURALLY DIFFERENT OBJECTS. This is the primary
//    mechanic, and it is the one that cannot be defeated.
//      concrete   → a day row containing a <ul> of NAMED ITEMS.
//      estimated  → a day row containing NO LIST AT ALL. One line of load,
//                   plus kind chips without counts.
//      trajectory → NOT A DAY ROW. Days stop existing; one summary block for
//                   the whole span.
//    A learner cannot mistake zone 2 for zone 1 because there is nothing to
//    tap open. Absence of affordance is a stronger honesty signal than any
//    styling — and it is enforced by the DATA, since `DayForecast.items` is
//    empty by construction outside the concrete zone.
//
// 2. NUMERIC PRECISION DEGRADES VISIBLY. Exact integers, then a leading `~`
//    and rounding to 5, then a half-month. A date that is never precise
//    cannot be read as precise.
//
// 3. EACH ZONE CARRIES ITS FIDELITY AS A WORD, in the heading — "exact",
//    "estimated", "a trajectory". §15's never-colour-alone, applied to time.
//
// 4. ONE SENTENCE OF *WHY*, at the boundary where the detail stops. The same
//    move §10 makes with "3 ayat are slipping. Not a failure — this is what
//    memory does." The app narrates its own limits.
//
// 5. A VISIBLE SEAM between zones — a hairline and a heading, so the
//    transition is a PLACE ON THE PAGE rather than a gradient someone has to
//    notice.
//
// The redundancy is deliberate. Any one device can be defeated: greyscale
// kills colour, a screen reader flattens layout, a translation weakens copy.
// Structure plus precision plus words plus copy means no single failure mode
// makes a far-future day look certain.
//
// A SERVER COMPONENT. The forecast arrives as a prop, already derived in
// `lib/plan/forecast.ts` — this file decides nothing.

import type { DayForecast, Forecast } from "@/lib/plan/forecast";

interface PlanCalendarProps {
  forecast: Forecast;
}

export function PlanCalendar({ forecast }: PlanCalendarProps) {
  const concrete = forecast.days.filter((d) => d.zone === "concrete");
  const estimated = forecast.days.filter((d) => d.zone === "estimated");

  return (
    <div className="stack">
      {/* ---- ZONE 1: CONCRETE ------------------------------------------- */}
      <section className="zone" data-testid="zone-concrete" aria-labelledby="zone-concrete-h">
        <h3 id="zone-concrete-h" className="zone__head">
          Next 3 days — exact
        </h3>
        <div className="stack stack--tight">
          {concrete.map((day) => (
            <ConcreteDay key={day.offset} day={day} />
          ))}
        </div>
      </section>

      {/* The seam. A hairline plus a heading, so the drop in fidelity is a
          place you arrive at, not a shade you are expected to notice. */}
      <hr className="zone__seam" />

      {/* ---- ZONE 2: ESTIMATED ------------------------------------------ */}
      <section className="zone" data-testid="zone-estimated" aria-labelledby="zone-estimated-h">
        <h3 id="zone-estimated-h" className="zone__head">
          The fortnight — estimated
        </h3>
        {/* Device 4: why the detail stops, stated where it stops. */}
        <p className="caption zone__why">
          We stop naming ayat here. Which ones come up depends on how the next
          few sessions actually go.
        </p>
        <div className="stack stack--tight">
          {estimated.map((day) => (
            <EstimatedDay key={day.offset} day={day} />
          ))}
        </div>
      </section>

      <hr className="zone__seam" />

      {/* ---- ZONE 3: TRAJECTORY ----------------------------------------- */}
      {/* NOT a list of days. One block for the whole span — a learner cannot
          expect item-level detail from a thing that has no per-day rows. */}
      <section className="zone" data-testid="zone-trajectory" aria-labelledby="zone-trajectory-h">
        <h3 id="zone-trajectory-h" className="zone__head">
          Beyond — a trajectory
        </h3>
        <p className="caption zone__why">
          Too far out to schedule. The commitment is what stays fixed: about
          eight minutes a day.
        </p>
        <p className="zone__trajectory">
          <strong>{forecast.paceLabel}</strong>
          <span className="meta-line__sep"> · </span>
          {/* A half-month, never a date. E-06 is closed (build-plan step 9),
              so the budget behind this number is SPLIT across enrolled surahs
              and the horizon is honest to show. If that split were ever
              removed, this clause must go with it — shipping a date you know
              is wrong is the precise failure §14 exists to prevent. */}
          <span>finishing {forecast.finishLabel}</span>
        </p>
      </section>
    </div>
  );
}

/** A concrete day: real items, exact counts, a list you could act on. */
function ConcreteDay({ day }: { day: DayForecast }) {
  if (day.away) return <AwayDay day={day} />;
  return (
    <div className="day-row" data-day-row data-zone="concrete">
      <div className="day-row__head">
        <strong>{day.dateLabel}</strong>
        {/* Exact. No tilde on a number we actually know. */}
        <span className="caption">{day.loadLabel}</span>
      </div>
      <ul className="day-row__items">
        {day.items.map((item, i) => (
          <li key={`${item.kind}-${i}`}>{item.label}</li>
        ))}
      </ul>
    </div>
  );
}

/** An estimated day: ONE LINE. No list, nothing to open, no ayah named. */
function EstimatedDay({ day }: { day: DayForecast }) {
  if (day.away) return <AwayDay day={day} />;
  return (
    <div className="day-row day-row--quiet" data-day-row data-zone="estimated">
      <div className="day-row__head">
        <strong>{day.dateLabel}</strong>
        <span className="caption">{day.loadLabel}</span>
      </div>
      {/* Kinds without counts. "2 gates · 9 reviews" would be the invented
          precision; "gates · reviews" is what we actually know. */}
      <p className="caption day-row__kinds">{day.kindsLabel}</p>
    </div>
  );
}

/**
 * A planned absence. §14: "the alternative teaches learners that the calendar
 * punishes life."
 *
 * It is NEVER styled as a miss, and specifically never with `.pill-streak`
 * (#95: PillStreak is the sole amber consumer, and amber is streak/consistency
 * semantics — an away day is neither a streak nor a break in one). It reuses
 * the muted register instead.
 */
function AwayDay({ day }: { day: DayForecast }) {
  return (
    <div className="day-row day-row--away" data-day-row data-away="true" data-zone={day.zone}>
      <div className="day-row__head">
        <strong>{day.dateLabel}</strong>
        <span className="caption">Away — no review expected</span>
      </div>
    </div>
  );
}
