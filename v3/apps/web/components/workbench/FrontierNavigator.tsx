"use client";

// PANE 1 of §22b — THE AYAH NAVIGATOR, WITH VERIFICATION CHIPS.
//
// "green verified, amber stale when the content hash no longer matches, grey
// unverified — turning the GATE-A frontier into a worklist."
//
// This component decides NOTHING. Ordering, chip reduction, counts and the
// per-row note all arrive as data from `lib/workbench/frontier.ts`; the load
// state arrives from `lib/workbench/verifications.ts`. What is left here is
// markup and the colour of a dot — which is exactly the division
// check-boundaries.mjs clause 5 exists to hold.
//
// THREE STATES, NEVER TWO. Loading, ready, unavailable. An unavailable frontier
// renders as an explicit "unknown" panel naming the reason, never as an empty
// list. An empty list reads as "nothing left to verify", which is the single
// most dangerous sentence this screen could tell a qari — it is the GATE-A
// metric, and GATE-A blocks public launch.
//
// The chip is announced in TEXT as well as colour: `aria-label` on the row and
// a visible status word beside the dot. A colour-only status on a screen whose
// entire job is "which ones need work" fails for ~8% of male reviewers, and the
// reviewers here are a small, specific, booked-by-calendar group.

import type { ChipState, FrontierRow, FrontierWorklist } from "@/lib/workbench/frontier.ts";
import type { FrontierLoad } from "@/lib/workbench/verifications.ts";

/** State → the ext layer's own chip class. The ONE place the mapping is made,
 *  so two panes cannot paint the same state differently. */
const CHIP_CLASS: Record<ChipState, string> = {
  verified: "wb-chip wb-chip--verified",
  stale: "wb-chip wb-chip--stale",
  unverified: "wb-chip wb-chip--unverified",
};

/** The word beside the dot. Colour is never the only channel. */
const CHIP_WORD: Record<ChipState, string> = {
  verified: "Verified",
  stale: "Stale",
  unverified: "Unverified",
};

export interface FrontierNavigatorProps {
  load: FrontierLoad;
  /** The ayah currently open in the other two panes, if any. */
  selectedAyah: number | null;
  onSelect: (ayah: number) => void;
}

function Counts({ worklist }: { worklist: FrontierWorklist }) {
  return (
    <div className="card-header">
      <span>
        {worklist.rows.length} ayah{worklist.rows.length === 1 ? "" : "t"}
      </span>
      {/* The counts, each with its word — the header is the worklist's
          summary and must survive being read aloud. */}
      <span>
        {worklist.stale} stale · {worklist.unverified} unverified ·{" "}
        {worklist.verified} verified
      </span>
    </div>
  );
}

function Row({
  row,
  selected,
  onSelect,
}: {
  row: FrontierRow;
  selected: boolean;
  onSelect: (ayah: number) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={["wb-row", selected ? "is-selected" : null].filter(Boolean).join(" ")}
        aria-current={selected ? "true" : undefined}
        // The full sentence, not just the number: a screen-reader user gets
        // the same three facts a sighted user gets from position + colour.
        aria-label={`Ayah ${row.ayah}. ${CHIP_WORD[row.chip]}. ${row.note}`}
        onClick={() => onSelect(row.ayah)}
      >
        {/* An LTR island: a reference is Latin digits and never reorders. */}
        <span className="ltr-island wb-row__ref">{row.ayah}</span>
        <span className={CHIP_CLASS[row.chip]} aria-hidden="true" />
        <span className="wb-row__word">{CHIP_WORD[row.chip]}</span>
        <span className="caption wb-row__note">{row.note}</span>
      </button>
    </li>
  );
}

export function FrontierNavigator({
  load,
  selectedAyah,
  onSelect,
}: FrontierNavigatorProps) {
  if (load.state === "loading") {
    // A skeleton, never zeros. "0 verified" during a load is a lie about
    // GATE-A, and this screen's whole purpose is that number.
    return (
      <section className="card" aria-labelledby="frontier-h" aria-busy="true">
        <div className="card-header">
          <h2 id="frontier-h" className="wb-h">
            VERIFICATION FRONTIER
          </h2>
        </div>
        <p className="caption">Loading the frontier…</p>
      </section>
    );
  }

  if (load.state === "unavailable") {
    return (
      <section className="card" aria-labelledby="frontier-h">
        <div className="card-header">
          <h2 id="frontier-h" className="wb-h">
            VERIFICATION FRONTIER
          </h2>
          <span>unknown</span>
        </div>
        {/* NOT an empty list. #167's rule: a failed probe renders `unknown`,
            never 0 — the console must distinguish healthy from blind. */}
        <p role="status" className="voice">
          The frontier could not be read, so this build cannot say what is
          verified. {load.reason}.
        </p>
      </section>
    );
  }

  const { worklist, certification } = load;

  return (
    <section className="card" aria-labelledby="frontier-h">
      <div className="card-header">
        <h2 id="frontier-h" className="wb-h">
          VERIFICATION FRONTIER
        </h2>
        <span>{worklist.allGreen ? "all green" : "work outstanding"}</span>
      </div>

      {/* v3-D22's claim rule, printed verbatim from `describeCertification` —
          this component decides nothing about WHETHER the words "scholar" or
          "certified" may appear, only where the sentence sits on the page. */}
      <p
        data-testid="certification-claim"
        className={
          certification.mayClaimScholarVerification ? "wb-cert wb-cert--affirmed" : "wb-cert"
        }
      >
        {certification.sentence}
      </p>

      {worklist.rows.length === 0 ? (
        // A TRUE empty — the API answered, and answered with nothing. Said
        // as an absence of data, never as an absence of work.
        <p className="voice">
          The API returned no ayat for this surah. Nothing has been ingested to
          verify against yet.
        </p>
      ) : (
        <>
          <Counts worklist={worklist} />
          {/* Ordered by urgency, and the order is DATA — see frontier.ts. */}
          <ul className="wb-list">
            {worklist.rows.map((row) => (
              <Row
                key={row.ayah}
                row={row}
                selected={row.ayah === selectedAyah}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
