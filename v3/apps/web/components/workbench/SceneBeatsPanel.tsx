"use client";

// SCENE BEAT PANE — diagnostic only, writes nothing.
//
// `corpus-compiler/src/sceneBeats.ts#buildSceneBeats` computes one row per
// narrative act on every compile where a mental model is authored (surah
// 12's own 19 acts, surah 67's draft), shipped on every compiled corpus's
// own `sceneBeats` field — but no reviewer-facing surface ever read any of
// it: the only production reference to `corpus.sceneBeats` anywhere in
// apps/web was a comment in OnboardingFlow.tsx explaining why
// `placement.ts` cannot honestly use it for a 4-ayah surah, never a real
// render.
//
// Sharpest instance: `RawAct.emotionalBeat` — a one-line description of an
// act's emotional register, hand-authored for all 19 of surah 12's acts
// alongside `sceneImage` (e.g. "Cold dread — love turned to murderous
// envy...") — was parsed from the raw mental-model file into memory on
// every compile and then silently dropped: `buildSceneBeats()` copied
// `act`/`ayahRange`/`sourceName` and the separately-authored `label`
// through, never `emotionalBeat`, and the engine's own `CorpusSceneBeat`
// type never declared it. A reviewer authoring or checking a surah's
// scene-beat LABEL — the human-only work `sceneBeats.ts`'s own header
// names — had no way to see the emotional context already written
// specifically to inform that authoring.
//
// This mirrors `LookAlikesPanel.tsx`'s own discipline exactly: per-ayah
// filtered, read-only, no write path. Every string it renders is either a
// fixture coordinate (surah/act/ayah, all integers) or the compiler's own
// vendored English text — never Quranic Arabic.

import type { CorpusSceneBeat } from "@engine/types.ts";

export interface SceneBeatsPanelProps {
  ayah: number;
  sceneBeats: readonly CorpusSceneBeat[];
}

export function SceneBeatsPanel({ ayah, sceneBeats }: SceneBeatsPanelProps) {
  const forAyah = sceneBeats.filter((sb) => sb.ayahs.includes(ayah));

  return (
    <section className="card" aria-labelledby="wb-scenebeat-h">
      <div className="card-header">
        <h2 id="wb-scenebeat-h" className="wb-h">
          SCENE BEAT
        </h2>
        <span className="ltr-island">{forAyah.length}</span>
      </div>

      {forAyah.length === 0 ? (
        <p className="caption">No scene beat recorded for this ayah.</p>
      ) : (
        <ul className="stack stack--tight">
          {forAyah.map((sb) => (
            <li key={sb.act} className="caption">
              <span className="ltr-island">
                act {sb.act} ({sb.ayahRange})
              </span>{" "}
              — {sb.sourceName}: {sb.label}
              {sb.emotionalBeat ? <> — emotional register: {sb.emotionalBeat}</> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
