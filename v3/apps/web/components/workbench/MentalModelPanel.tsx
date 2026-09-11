"use client";

// MENTAL MODEL PANE — diagnostic only, writes nothing.
//
// `corpus-compiler/src/buildCorpus.ts` reads a surah's whole raw
// `<surah>-mental-model.json` file into `RawMentalModel` on every compile
// (`title`, `oneLineSpine`, `acts`, `memoryHooks`, `pairingStrategy`) — but
// only `acts` ever left that function: it became `sceneBeats`
// (`SceneBeatsPanel.tsx`) and `meta.hasMentalModel`. The other four fields —
// the surah-level narrative spine and its memory hooks, exactly the
// per-surah "mental model" content BUILD-PLAN's own edge case #22 and Q13
// name as a human-authored launch requirement (macro-panel mental models) —
// were parsed into memory and then discarded: `grep -n "oneLineSpine\|
// memoryHooks\|pairingStrategy" packages/corpus-compiler/src/buildCorpus.ts`
// found no read of any of the three anywhere in that function before this
// fix, and the engine's own `Corpus["meta"]` never declared a place for
// them to land even if it had.
//
// Consequence: surah 12's own vendored `data/raw/12-mental-model.json` names
// a real title, a one-line narrative spine and several authored memory
// hooks — content written specifically to help a reviewer (and eventually a
// learner) hold the whole surah's shape in mind — and none of it ever
// reached any screen. A reviewer authoring or checking a surah's per-act
// scene-beat labels (`SceneBeatsPanel.tsx`) had no way to see the
// surah-level frame those labels are meant to fit into.
//
// This mirrors `DistractorYieldPanel.tsx`/`MacroClassificationPanel.tsx`'s
// own discipline exactly: read-only, no write path, no learner-facing
// consequence — surfaced on the admin workbench only. Every string
// rendered is the compiler's own vendored English editorial text, never
// Quranic Arabic.

export interface MentalModelSummary {
  title: string;
  oneLineSpine: string;
  memoryHooks: string[];
  pairingStrategy: string;
}

export interface MentalModelPanelProps {
  mentalModel: MentalModelSummary | undefined;
}

export function MentalModelPanel({ mentalModel }: MentalModelPanelProps) {
  return (
    <section className="card" aria-labelledby="wb-mentalmodel-h">
      <div className="card-header">
        <h2 id="wb-mentalmodel-h" className="wb-h">
          MENTAL MODEL
        </h2>
      </div>

      {mentalModel === undefined ? (
        <p className="caption">No mental model authored for this surah.</p>
      ) : (
        <div className="stack stack--tight">
          <p className="caption">
            <strong>{mentalModel.title}</strong>
          </p>
          <p className="caption">{mentalModel.oneLineSpine}</p>
          {mentalModel.memoryHooks.length === 0 ? (
            <p className="caption">No memory hooks recorded.</p>
          ) : (
            <ul className="stack stack--tight">
              {mentalModel.memoryHooks.map((hook, i) => (
                <li key={i} className="caption">
                  {hook}
                </li>
              ))}
            </ul>
          )}
          <p className="caption">Pairing strategy: {mentalModel.pairingStrategy}</p>
        </div>
      )}
    </section>
  );
}
