// Free-practice doors (FR6), lean. Shown after the structured session completes:
//   1. Extra Learn (scheduler-granted, gate intact, cost disclosed)
//   2. Weak-spot gym (full-weight rehearsal of the weakest carried atoms)
//   3. Open practice (any ayah × any drill; evidence-only)
// Each door opens an existing drill. Consumes iman-ui.css.

import { useState } from "react";
import {
  extraLearnGrant,
  weakSpots,
  type AtomsMap,
  type Corpus,
} from "engine";
import { OpenPractice } from "./OpenPractice.tsx";

type Door = "menu" | "open";

export function Doors({
  corpus,
  atoms,
  learnCandidates,
  wordCounts,
  onClose,
}: {
  corpus: Corpus;
  atoms: AtomsMap;
  learnCandidates: number[];
  wordCounts: Map<number, number>;
  onClose: () => void;
}) {
  const [door, setDoor] = useState<Door>("menu");
  const atomList = [...atoms.values()];
  const grant = extraLearnGrant(atomList, learnCandidates, Date.now(), wordCounts);
  const weak = weakSpots(atomList, Date.now(), 3);

  if (door === "open") {
    return <OpenPractice corpus={corpus} onClose={() => setDoor("menu")} />;
  }

  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>Practice</span>
          <span>three doors</span>
        </div>
        <p className="voice">Your session's done. Want a little more?</p>

        {/* Door 1 — Extra Learn (cost disclosed) */}
        <button
          className="btn"
          disabled={!grant.granted}
          onClick={onClose /* extra learn re-enters the session queue */}
        >
          {grant.granted
            ? `Learn one more — 12:${grant.ayah} (~${grant.costMin} min, gate intact)`
            : `Extra Learn unavailable — ${grant.reason}`}
        </button>

        {/* Door 2 — Weak-spot gym */}
        <button className="btn" disabled={weak.length === 0} onClick={() => setDoor("open")}>
          {weak.length
            ? `Weak-spot gym — ${weak.length} soft spot${weak.length > 1 ? "s" : ""} to firm up`
            : "Weak-spot gym — nothing weak yet"}
        </button>

        {/* Door 3 — Open practice */}
        <button className="btn" onClick={() => setDoor("open")}>
          Open practice — any ayah, any drill
        </button>

        <button className="btn btn--ghost" onClick={onClose}>
          Done for now
        </button>
      </div>
    </div>
  );
}
