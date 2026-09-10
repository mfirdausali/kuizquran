"use client";

// DISTRACTOR YIELD PANE — diagnostic only, writes nothing.
//
// `corpus-compiler/src/buildCorpus.ts` computes two REQUIRED fields on every
// compiled corpus's own `meta` since build-plan step 3 — `distractorOrigin`
// (how many of this surah's distractor rows were hand-authored vs. derived
// by the foil kernels) and `kernelYield` (a histogram of foils-per-word,
// the compiler's own "honest degradation" record: "a surah whose words only
// reach 2 or 3 foils shows up here, rather than silently padded"). Both ship
// to the browser verbatim — `stage-corpus.mjs#slim()` passes `meta` through
// wholesale, and the SSR loader reads the compiled JSON directly — but the
// engine's own `Corpus` type never declared either field, so nothing
// downstream could reach them even by accident: the same "shipped, never
// declared on the consuming type" shape `Corpus.lookalikes` and
// `CorpusWord.line` already closed for one field apiece.
//
// Consequence: a reviewer judging why a surah's distractors feel thin (a
// kernel-only surah with a low-yield word) or auditing how much of a
// surah's foil set is qari-authored versus machine-derived had no way to
// see either fact anywhere — only by reading `output/<surah>/corpus.json`
// by hand.
//
// This mirrors `LookAlikesPanel.tsx`/`MacroClassificationPanel.tsx`'s own
// discipline exactly: read-only, no write path, no learner-facing
// consequence. Every string rendered is an integer or a fixed English
// label — never Arabic, never authored prose.

export interface DistractorYieldMeta {
  distractorOrigin?: { authored: number; kernel: number };
  kernelYield?: Record<number, number>;
}

export interface DistractorYieldPanelProps {
  meta: DistractorYieldMeta;
}

export function DistractorYieldPanel({ meta }: DistractorYieldPanelProps) {
  const { distractorOrigin, kernelYield } = meta;
  // Sorted ascending by yield count (2 foils before 5), never Object.keys'
  // insertion order — a compile that happens to emit keys out of order must
  // not read as a different histogram shape.
  const yieldEntries = kernelYield
    ? Object.entries(kernelYield)
        .map(([n, words]) => ({ n: Number(n), words }))
        .sort((a, b) => a.n - b.n)
    : null;

  return (
    <section className="card" aria-labelledby="wb-yield-h">
      <div className="card-header">
        <h2 id="wb-yield-h" className="wb-h">
          DISTRACTOR YIELD
        </h2>
      </div>

      {distractorOrigin ? (
        <p className="caption">
          <span className="ltr-island">{distractorOrigin.authored}</span> authored,{" "}
          <span className="ltr-island">{distractorOrigin.kernel}</span> kernel-derived.
        </p>
      ) : (
        <p className="caption">No distractor-origin summary for this corpus subset.</p>
      )}

      {yieldEntries ? (
        yieldEntries.length === 0 ? (
          <p className="caption">No distractor yield recorded.</p>
        ) : (
          <ul className="stack stack--tight">
            {yieldEntries.map(({ n, words }) => (
              <li key={n} className="caption">
                <span className="ltr-island">{words}</span> word{words === 1 ? "" : "s"} got{" "}
                <span className="ltr-island">{n}</span> foil{n === 1 ? "" : "s"}.
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="caption">No distractor yield histogram for this corpus subset.</p>
      )}
    </section>
  );
}
