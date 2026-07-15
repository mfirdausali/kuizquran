// The 2-minute floor session (FR9). Always offered, always finishable, never
// empty — the smallest viable touch to keep the habit alive on the worst days.
// Reuses engine floorQueue; runs a quick S2-form review on the chosen atom(s).
// Consumes iman-ui.css. No guilt copy.

import { useMemo, useState } from "react";
import { floorQueue, floorMinutes, type AtomsMap, type Corpus } from "engine";
import { OpenPractice } from "../practice/OpenPractice.tsx";

export function FloorSession({
  corpus,
  atoms,
  onClose,
}: {
  corpus: Corpus;
  atoms: AtomsMap;
  onClose: () => void;
}) {
  const queue = useMemo(() => floorQueue([...atoms.values()], Date.now()), [atoms]);
  const [started, setStarted] = useState(false);

  if (started) {
    // Run a quick meaning pass on the floor item's ayah (evidence-only, via the
    // existing open-practice drill — the lean reuse).
    const ayah = queue[0]?.ref ?? 4;
    return <OpenPractice corpus={corpus} onClose={onClose} initialAyah={ayah} />;
  }

  const mins = Math.max(1, Math.round(floorMinutes(queue)));
  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>Just two minutes</span>
          <span>floor session</span>
        </div>
        <div className="banner banner--ok">
          <p>A tiny touch keeps it alive — about {mins} minute{mins > 1 ? "s" : ""}, {queue.length} item{queue.length > 1 ? "s" : ""}.</p>
          <p className="sub">No pressure. Even a little today beats nothing.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setStarted(true)}>
          Start the 2-minute touch
        </button>
        <button className="btn btn--ghost" onClick={onClose}>
          Not now
        </button>
      </div>
    </div>
  );
}
