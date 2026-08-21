"use client";

// THE OPEN-PRACTICE PICKER — FR6 Door 3. Choosing WHICH ayah and HOW HARD. It
// never drills anything.
//
// ---------------------------------------------------------------------------
// THIS COMPONENT DECIDES NOTHING
// ---------------------------------------------------------------------------
// Unlike `DrillPicker`, this one does not even need the log: open practice has
// no readiness precondition (an untaught ayah is exactly what it is for), so
// there is nothing here for `check-boundaries.mjs` clause 5 to catch — no
// strength comparison, no band test, nothing to derive from the fold. The
// component clamps a number to the corpus's own ayah count (metadata, not a
// scheduling decision) and links to `/session` with the choice in the URL
// (`lib/practice/handoff.ts`). `run.ts#startOpenPractice` decides everything
// else, including whether the ayah is actually valid.
//
// The two difficulties are named by their EFFECT ("about half the ayah is
// blanked" / "the whole ayah is blanked"), never by the internal S2/S3
// jargon — the same "consequence, not jargon" rule `DrillPicker`'s own header
// states for graded vs. victory-lap.

import { useState } from "react";
import Link from "next/link";
import type { Corpus } from "@engine/types.ts";
import { practiceHref } from "@/lib/practice/handoff";
import type { OpenPracticeDrill } from "@/lib/session/run";

interface PracticePickerProps {
  corpus: Corpus;
}

export function PracticePicker({ corpus }: PracticePickerProps) {
  const ayahCount = corpus.meta.ayahCount;
  const [ayah, setAyah] = useState(1);
  const [drill, setDrill] = useState<OpenPracticeDrill>("S2");

  const clamp = (n: number) => Math.min(Math.max(1, Math.trunc(n) || 1), ayahCount);

  return (
    <div className="stack">
      <fieldset className="drill-fieldset">
        <legend className="drill-legend">Which ayah</legend>
        <div className="drill-row">
          <label className="drill-label" htmlFor="practice-ayah">
            Ayah
          </label>
          <input
            id="practice-ayah"
            className="drill-input"
            type="number"
            min={1}
            max={ayahCount}
            value={ayah}
            onChange={(e) => setAyah(clamp(Number(e.target.value)))}
          />
        </div>
        <p className="caption">
          Any ayah — taught or not. This is free practice: nothing here can be
          damaged.
        </p>
      </fieldset>

      <fieldset className="drill-fieldset">
        <legend className="drill-legend">How hard</legend>
        <label className="drill-mode">
          <input
            type="radio"
            name="practice-drill"
            value="S2"
            checked={drill === "S2"}
            onChange={() => setDrill("S2")}
          />
          <span className="drill-mode-name">Partial</span>
          <span className="drill-mode-consequence">About half the ayah is blanked.</span>
        </label>
        <label className="drill-mode">
          <input
            type="radio"
            name="practice-drill"
            value="S3"
            checked={drill === "S3"}
            onChange={() => setDrill("S3")}
          />
          <span className="drill-mode-name">Full</span>
          <span className="drill-mode-consequence">The whole ayah is blanked.</span>
        </label>
      </fieldset>

      <Link className="btn" href={practiceHref({ ayah, drill })} data-testid="practice-start">
        Start free practice — ayah {ayah}
      </Link>
    </div>
  );
}
