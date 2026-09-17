// WIREFRAME §14 "Planned absences" — the pre-first-session half (v3-D220).
//
// `PlanIsland`'s "empty" case (zero events for this surah) correctly refuses
// to project a forecast from nothing — §14's own honesty mechanic, #73's
// "skeletons are never zeros" applied to a log instead of a load — but a
// forecast and a calendar are not the same thing. §14 says "ANY future day
// can be marked away," and marking one is a plain toggle over a day INDEX
// (`setDayAway`/`day_marked_away`, v3-D207): it needs no atom, no rebuild, no
// forecast, so a learner with no session history yet still has a real reason
// to reach for it — booking travel before a first session is not a rarer
// case than booking it after.
//
// THIS FILE DECIDES NOTHING ABOUT SCHEDULING. It enumerates the same future
// window `lib/plan/forecast.ts` names (`ESTIMATED_THROUGH_DAY`, offsets
// 1..14 — never 0, a day already underway is not a planned absence) and asks
// the caller to commit a toggle. No item, no load, no zone: those facts do
// not exist yet, and inventing a placeholder for any of them would be
// exactly the "projecting a schedule for a learner who has not started" lie
// PlanIsland's own zero-state sentence exists to refuse.

import { dateLabel, ESTIMATED_THROUGH_DAY } from "@/lib/plan/forecast";

const DAY_MS = 86_400_000;

interface EmptyPlanAwayListProps {
  now: number;
  tz: string;
  /** Present only when the caller can actually commit the toggle — omitted
   *  (v3-D226: this tab does not hold the write lock, `lib/idb/writeLock.ts`
   *  edge case #75) this stays a pure read-only render, no button, no
   *  affordance, the identical discipline `PlanCalendar`'s own
   *  `MarkAwayButton` already establishes for the exact same reason. */
  onToggleAway?: (offset: number, away: boolean) => void;
}

export function EmptyPlanAwayList({ now, tz, onToggleAway }: EmptyPlanAwayListProps) {
  const offsets = Array.from({ length: ESTIMATED_THROUGH_DAY }, (_, i) => i + 1);
  return (
    <div className="stack stack--tight" data-testid="empty-plan-away-list">
      <p className="caption">
        Already know you&rsquo;ll be away one day soon? You can mark it now —
        it will be waiting once your plan starts.
      </p>
      {offsets.map((offset) => (
        <div key={offset} className="day-row day-row--quiet" data-day-row data-offset={offset}>
          <div className="day-row__head">
            <strong>{dateLabel(now + offset * DAY_MS, offset, tz)}</strong>
          </div>
          {onToggleAway ? (
            <button
              type="button"
              className="btn btn--ghost day-row__away-toggle"
              onClick={() => onToggleAway(offset, true)}
            >
              Mark this day away
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
