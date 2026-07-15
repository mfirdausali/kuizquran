// Decay-visible line (FR9): "72% → 64% since Thursday" on a due item. Reuses
// engine decaySince. Consumes .caption from iman-ui.css.

import { decaySince, type AtomState } from "engine";

export function DecayLine({ atom, since, now }: { atom: AtomState; since: number; now: number }) {
  const d = decaySince(atom, since, now);
  if (!d.declined) return null;
  return (
    <p className="caption">
      {d.sincePct}% → {d.nowPct}% since {d.sinceLabel}
    </p>
  );
}
