"use client";

// PROVENANCE PANE — diagnostic only, writes nothing.
//
// `corpus-compiler/src/io.ts#readInputs` assembles `generatedFrom: string[]`
// (the raw verses/geometry/ruku/mental-model files, plus the QAC morphology
// file and its version tag) on EVERY compile — a required field on the
// compiler's own `CorpusMeta` (`corpus-compiler/src/types.ts`), carried
// through by `buildCorpus.ts` and shipped to the browser verbatim, since
// `stage-corpus.mjs#slim()` passes `meta` through wholesale. But the
// engine's own `Corpus["meta"]` never declared a place for it to land, so no
// TypeScript-typed reader in `apps/web` could reach it even by accident —
// the same "shipped, never declared on the consuming type" shape
// `Corpus.lookalikes` (v3-D181), `CorpusWord.line` (v3-D191) and
// `CorpusMeta.distractorOrigin`/`.kernelYield` (v3-D192) already closed.
//
// Consequence: a reviewer on `/workbench` — the one screen that already
// audits `corpusHash`/`hashSpecVersion`/`droppedCollisions` for exactly this
// kind of build provenance — had no way to see WHICH raw files (and which
// QAC version) actually produced the corpus in front of them, despite the
// compiler already knowing and already shipping the answer.
//
// This mirrors `MentalModelPanel.tsx`'s own discipline exactly: surah-level
// (not per-ayah), read-only, no write path, no learner-facing consequence.
// Every string rendered is a file path or a version tag the compiler itself
// recorded — never Arabic.

export interface GeneratedFromPanelProps {
  generatedFrom: string[] | undefined;
}

export function GeneratedFromPanel({ generatedFrom }: GeneratedFromPanelProps) {
  return (
    <section className="card" aria-labelledby="wb-provenance-h">
      <div className="card-header">
        <h2 id="wb-provenance-h" className="wb-h">
          PROVENANCE
        </h2>
      </div>

      {generatedFrom === undefined || generatedFrom.length === 0 ? (
        <p className="caption">No provenance recorded for this corpus subset.</p>
      ) : (
        <ul className="stack stack--tight">
          {generatedFrom.map((path, i) => (
            <li key={i} className="caption">
              <span className="ltr-island">{path}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
