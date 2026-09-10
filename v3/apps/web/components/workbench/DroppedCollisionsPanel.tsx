"use client";

// DROPPED COLLISIONS PANE — diagnostic only, writes nothing.
//
// `corpus-compiler/src/foilKernels.ts#admitAuthored` routes every AUTHORED
// distractor row through the same grading-equivalence accumulator the
// learner is graded with (NFC + tatweel strip, DEFECTS.md#B6's own rule).
// A row that collides with its own target under that equivalence — e.g. a
// tatweel-only variant, byte-different but grade-identical — is dropped at
// compile, not padded (Absolute B: never invent Arabic to fill the gap).
// `buildCorpus.ts` records every dropped coordinate on the compiled
// corpus's own `meta.droppedCollisions` (required there) since build-plan
// step 3, and it ships to the browser verbatim — `stage-corpus.mjs#slim()`
// passes `meta` through wholesale — but the engine's own `Corpus` type
// never declared the field, so nothing downstream could reach it even by
// accident. Same "shipped, never declared on the consuming type" shape
// `Corpus.lookalikes` (v3-D181), `CorpusWord.line` (v3-D191) and
// `CorpusMeta.distractorOrigin`/`.kernelYield` (v3-D192) already closed.
//
// Consequence: a word named here shipped with FEWER distractors than were
// actually authored for it — a fact `DistractorYieldPanel`'s own histogram
// cannot distinguish from a word that was simply never given more than a
// few foils. A reviewer auditing a thin option set at a coordinate had no
// way to tell "the compiler dropped a redundant row here" from "nobody
// authored more" without reading `output/<surah>/corpus.json` by hand.
//
// This mirrors `LookAlikesPanel.tsx`'s own discipline exactly: per-ayah
// filtered, read-only, no write path. Every string rendered is a fixture
// coordinate (surah/ayah/position, all integers) — never Arabic.

import type { LookAlikeWordRef } from "@engine/types.ts";

export interface DroppedCollisionsPanelProps {
  surah: number;
  ayah: number;
  droppedCollisions: readonly LookAlikeWordRef[];
}

export function DroppedCollisionsPanel({ surah, ayah, droppedCollisions }: DroppedCollisionsPanelProps) {
  const forAyah = droppedCollisions.filter((c) => c.ayah === ayah);

  return (
    <section className="card" aria-labelledby="wb-dropped-h">
      <div className="card-header">
        <h2 id="wb-dropped-h" className="wb-h">
          DROPPED COLLISIONS
        </h2>
        <span className="ltr-island">{forAyah.length}</span>
      </div>

      {forAyah.length === 0 ? (
        <p className="caption">No dropped collisions recorded for this ayah.</p>
      ) : (
        <ul className="stack stack--tight">
          {forAyah.map((c) => (
            <li key={`${c.ayah}:${c.position}`} className="caption">
              <span className="ltr-island">
                {surah}:{c.ayah}:{c.position}
              </span>{" "}
              — an authored distractor collided with the target at compile and was dropped;
              this word shipped with fewer options than authored.
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
