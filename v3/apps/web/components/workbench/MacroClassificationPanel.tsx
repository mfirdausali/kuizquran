"use client";

// THE MACRO CLASSIFICATION PANEL — diagnostic only, writes nothing.
//
// `corpus-compiler/src/macro.ts#classify()` stamps a `reason` on every
// MacroFacts it emits — the audit trail for WHICH v3-D21 rule fired, e.g.
// "ayahCount=3", "ruku=12", "rhyme -uun 78%", "refrain x3", or "default".
// It is a REQUIRED field and ships to the browser on every compiled corpus's
// own `meta.macro` (v3-D136), but `MacroFacts.reason`'s own docblock says it
// is "rendered nowhere by default" — correctly so for the LEARNER-facing
// `MacroPanel`, which has no business showing a compiler internal to a
// learner. Nothing on the ADMIN side showed it either: a reviewer looking at
// a borderline classification (a surah sitting exactly at RING_MIN_RUKU, or
// one that fell through to ARC because a vendoring error left its ruku/rhyme
// inputs missing) had no way to see WHY the compiler decided what it did,
// short of reading source.
//
// This mirrors `ExplainTrace.tsx`/`LookAlikesPanel.tsx`'s own discipline:
// read-only, no write path, no learner-facing consequence. Every string it
// renders is the compiler's own fixed archetype/reason string — never
// Arabic, never authored prose.

import type { MacroFacts } from "@/components/macro/facts.ts";

export interface MacroClassificationPanelProps {
  facts: MacroFacts;
}

export function MacroClassificationPanel({ facts }: MacroClassificationPanelProps) {
  return (
    <section className="card" aria-labelledby="wb-macro-h">
      <div className="card-header">
        <h2 id="wb-macro-h" className="wb-h">
          MACRO CLASSIFICATION
        </h2>
        <span className="ltr-island">{facts.archetype}</span>
      </div>
      <p className="caption">
        Why: <span className="ltr-island">{facts.reason}</span>
      </p>
    </section>
  );
}
