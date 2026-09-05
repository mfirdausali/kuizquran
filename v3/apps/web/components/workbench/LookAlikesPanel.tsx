"use client";

// LOOK-ALIKES PANE (§22b's reviewer surface, one more field of it).
//
// `corpus-compiler/src/lookalikes.ts#buildLookAlikes` computes cross-verse
// confusion pairs at compile time — the same normalized form recurring in a
// different ayah, or a near-identical script form — and ships them on every
// compiled corpus's own `lookalikes` field. It was validated at compile
// (`validate.ts`) and counted in the build summary, but no reviewer-facing
// surface ever read it: the engine's own `Corpus` type did not even declare
// the field, so nothing downstream could reach it even by accident.
//
// This pane is diagnostic only, exactly like `ExplainTrace`: it names pairs
// a reviewer may want to double-check when authoring a distractor or judging
// a gloss, and it writes nothing and grades nothing. Every string it renders
// is either a fixture coordinate (surah/ayah/position, all integers) or the
// compiler's own fixed reason string — never Arabic.

import type { LookAlike } from "@engine/types.ts";

export interface LookAlikesPanelProps {
  ayah: number;
  lookalikes: readonly LookAlike[];
}

export function LookAlikesPanel({ ayah, lookalikes }: LookAlikesPanelProps) {
  const forAyah = lookalikes.filter((la) => la.a.ayah === ayah || la.b.ayah === ayah);

  return (
    <section className="card" aria-labelledby="lookalikes-h">
      <div className="card-header">
        <h2 id="lookalikes-h" className="wb-h">
          LOOK-ALIKES
        </h2>
        <span className="ltr-island">{forAyah.length}</span>
      </div>

      {forAyah.length === 0 ? (
        <p className="caption">No cross-verse look-alikes recorded for this ayah.</p>
      ) : (
        <ul className="stack stack--tight">
          {forAyah.map((la) => {
            const self = la.a.ayah === ayah ? la.a : la.b;
            const other = la.a.ayah === ayah ? la.b : la.a;
            return (
              <li key={`${self.ayah}:${self.position}-${other.ayah}:${other.position}`} className="caption">
                <span className="ltr-island">
                  {la.surah}:{self.ayah}:{self.position} ↔ {la.surah}:{other.ayah}:{other.position}
                </span>{" "}
                — {la.reason} (score {la.score})
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
