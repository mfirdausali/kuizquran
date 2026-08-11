"use client";

// PANE 3 of §22b — SPEC PREVIEW + THE explain() TRACE.
//
// "spec editor + live preview at three strengths using the SAME React
// components the learner sees, plus an explain() trace."
//
// THE SAME COMPONENTS IS THE WHOLE POINT. This file imports `QuizCard` — the
// learner's dispatcher — and hands it a `RenderItem` straight out of
// `buildQuestion`. It does not have a preview renderer, an admin variant, or a
// simplified card. If it did, the preview would be a drawing of the product
// rather than the product, and a workbench that shows an admin something the
// learner will not see is worse than no workbench: it manufactures confidence.
//
// A preview tap goes nowhere. `onAnswer` is a no-op and no `reveal` is passed,
// so the card sits in its live, pre-tap state — which is what an author is
// judging. Nothing here writes to the log, and nothing here can: this component
// has no append path and no engine decision to make.
//
// SACRED TEXT: not one Arabic glyph in this file. Every glyph the preview
// paints arrived at runtime as a `Face`, resolved by `faces.ts#buildFace` from a
// `CorpusRef`, and is painted by `FaceText` inside the RTL island. This file
// only decides WHICH RenderItem to hand over.

import type { Explanation, LaneTrace, VariantTrace } from "@/lib/workbench/explain.ts";
import { QuizCard } from "@/components/quiz/QuizCard";

/** A tap in the preview is inert. Named rather than inlined so it is obvious
 *  at a glance that no handler exists, rather than looking like an omission. */
function inert(): void {
  /* preview only — nothing is graded, nothing is logged */
}

function VariantRow({ variant }: { variant: VariantTrace }) {
  return (
    <li className={variant.admitted ? "wb-var is-ok" : "wb-var is-dropped"}>
      <span className="ltr-island wb-var__idx">
        #{variant.index}
        {variant.position === null ? "" : ` · pos ${variant.position}`}
      </span>
      <span className="caption">{variant.note}</span>
    </li>
  );
}

function LaneBlock({ lane }: { lane: LaneTrace }) {
  const dropped = lane.enumerated - lane.admitted;
  return (
    <div className="wb-lane">
      <div className="card-header">
        <span className="wb-lane__name">{lane.lane}</span>
        <span>
          {/* Enumerated → admitted → dropped, exactly the arithmetic
              WIREFRAME §23 Q1 states ("s1 31→27, 4 dropped"). */}
          {lane.enumerated} enumerated · {lane.admitted} admitted ·{" "}
          {dropped} dropped
        </span>
      </div>
      {lane.variants.length === 0 ? (
        <p className="caption">This lane enumerates nothing at this site.</p>
      ) : (
        <ul className="wb-list wb-list--flush">
          {lane.variants.map((v) => (
            <VariantRow key={`${v.lane}-${v.index}`} variant={v} />
          ))}
        </ul>
      )}
    </div>
  );
}

export interface ExplainTraceProps {
  explanation: Explanation;
  /** Surah, for `locateChoice`'s "12:4" option labels — the learner card's
   *  own prop, passed through unchanged. */
  surah: number;
}

export function ExplainTrace({ explanation, surah }: ExplainTraceProps) {
  const { supply, previews, lanes, specLane, built, declineReason } = explanation;

  return (
    <section className="card" aria-labelledby="explain-h">
      <div className="card-header">
        <h2 id="explain-h" className="wb-h">
          PREVIEW &amp; TRACE
        </h2>
        <span className="ltr-island">{supply.siteKey}</span>
      </div>

      {/* ---- BUILD: what the spec under edit produced. ---- */}
      {built ? (
        <div className="wb-previews">
          {previews.map((p) => (
            <div key={p.strength} className="wb-preview">
              <div className="card-header">
                {/* NOTE ON THE PHRASING HERE. The obvious markup —
                    `strength <span>{p.strength}</span>` — fails
                    check-boundaries.mjs clause 5, because the clause's
                    `strength\s*[<>]` pattern cannot tell a JSX tag opener from
                    a real comparison. The clause is not weakened to accommodate
                    this file: the label is simply written so the word is not
                    adjacent to an angle bracket. A gate that over-fires on a
                    view is a cheap cost; a gate loosened once is loosened
                    forever, and this one is what keeps DEFECTS.md#B2 dead. */}
                <span>
                  {p.band} · <span className="ltr-island">{p.strength}</span> strength
                </span>
                <span>
                  {/* The engine's own knob, shown so an author can see WHY two
                      previews differ — or, today, why they do not. */}
                  {p.optionSpec.count} options · max rank{" "}
                  <span className="ltr-island">{p.optionSpec.maxRank}</span>
                </span>
              </div>
              {p.item ? (
                // THE LEARNER'S OWN DISPATCHER. Not a preview renderer.
                <QuizCard
                  item={p.item}
                  onAnswer={inert}
                  label={`${supply.siteKey} · ${explanation.spec.lane}`}
                  surah={surah}
                />
              ) : (
                <p className="voice">Nothing built at this strength.</p>
              )}
              {/* Both booleans arrive as DATA from explain(). The first draft
                  compared strengths here and check-boundaries.mjs clause 5
                  failed the build on it — correctly: a strength comparison in
                  JSX is DEFECTS.md#B2's exact shape, and the clause does not
                  care that this one was harmless. */}
              {!p.isBaseline && !p.differsFromLearn ? (
                // Stated, not hidden. Three identical cards with no explanation
                // would read as a rendering bug or, worse, as evidence that
                // strength IS being honoured.
                <p className="caption">
                  Identical to the Learn preview — this lane&apos;s kernel does
                  not yet vary with strength.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p role="status" className="voice">
          This spec builds nothing. {declineReason}
        </p>
      )}

      {/* ---- SUPPLY: the engine's ResourceLedger, never recounted here. ---- */}
      <div className="wb-section">
        <div className="card-header">
          <span>SUPPLY</span>
          <span>
            {supply.kind === "seam"
              ? supply.successorExists
                ? "has a following ayah"
                : "no following ayah"
              : `${supply.positions.length} positions`}
          </span>
        </div>
        {supply.positions.length === 0 ? (
          <p className="caption">
            A seam has no per-position supply — its one supply fact is whether a
            following ayah exists.
          </p>
        ) : (
          <ul className="wb-list wb-list--flush">
            {supply.positions.map((p) => (
              <li key={p.position} className="wb-var">
                <span className="ltr-island wb-var__idx">pos {p.position}</span>
                <span className="caption">
                  {p.s1Siblings} distinct sibling gloss
                  {p.s1Siblings === 1 ? "" : "es"} · {p.clozeDistractors} eligible
                  distractor{p.clozeDistractors === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- FIBRE: every candidate, with admit()'s verdict. ---- */}
      <div className="wb-section">
        <div className="card-header">
          <span>FIBRE</span>
          <span>
            {specLane
              ? `spec lane: ${specLane.lane}`
              : `spec lane ${explanation.spec.lane} has no single-site enumerator`}
          </span>
        </div>
        {specLane === null ? (
          // v3-D37 gap 1, surfaced instead of silently showing three lanes and
          // letting an admin assume the spec's own lane is among them.
          <p className="caption">
            <code>variants()</code> enumerates s1, cloze and junction only. The
            lanes below are this site&apos;s full traceable fibre; the spec under
            edit is not one of them, so its candidates cannot be listed.
          </p>
        ) : null}
        {lanes.map((lane) => (
          <LaneBlock key={lane.lane} lane={lane} />
        ))}
      </div>
    </section>
  );
}
