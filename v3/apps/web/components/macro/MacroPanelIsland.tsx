"use client";

// THE CLIENT ISLAND — rule 5 / edge case #72.
//
// ---------------------------------------------------------------------------
// WHY THE GRAPH CANNOT BE BUILT ON THE SERVER
// ---------------------------------------------------------------------------
// The nodes are LOG-DERIVED: every stage and every percentage comes from the
// learner's IndexedDB event log. A server render has no log, so it would paint
// every atom at 0% / "Not started"; the client would then hydrate the real
// values, and in PRODUCTION React silently keeps the server's markup. The
// learner is shown "Not started" for an ayah they have carried for weeks.
//
// That is edge case #72 exactly, and check-boundaries.mjs clauses 1-2 exist to
// make it impossible: anything reaching `lib/idb` declares "use client".
//
// SO THE SPLIT IS:
//   facts  — corpus-derived, learner-INVARIANT  -> server, in the RSC payload
//   nodes  — log-derived, PER-LEARNER           -> here, after hydration
//
// Keeping them as two props is also what stops someone merging them into one
// server fetch later and reintroducing #72 without noticing.
//
// ---------------------------------------------------------------------------
// FOUR STATES, EXHAUSTIVELY — edge case #73
// ---------------------------------------------------------------------------
// `LogState` is a discriminated union precisely so `pending` and `empty` can
// never collapse into each other:
//
//   pending — the log is still opening/reading. Paint `.skel`. NEVER a number,
//             never 0. A ring drawn at 0% is not a loading state; it is a
//             false claim about the learner's memory.
//   empty   — the log opened cleanly and has no rows. This is a REAL, correct
//             answer (a new learner), and the honest render is the full graph
//             with every mark reading "Not started".
//   ready   — render the graph from the folded atoms.
//   broken  — say so. A silent fallback to an empty graph here would be
//             indistinguishable from `empty`, i.e. a lie about a failure.

import { useCallback } from "react";

import { rebuild } from "@engine/rebuild.ts";
import type { DrillEvent } from "@engine/types.ts";
import { getAllEvents } from "@/lib/idb/read.ts";
import { useLogState } from "@/lib/idb/useLogState.ts";

import type { MacroFacts } from "./facts.ts";
import { buildGraphNodes } from "./graphNodes.ts";
import { MacroPanel, MACRO_HEADING_ID } from "./MacroPanel.tsx";

export interface MacroPanelIslandProps {
  surah: number;
  ayahCount: number;
  /** Corpus-derived and learner-invariant, so it crosses the boundary as a
   *  plain serialisable object rather than being recomputed on the client. */
  facts: MacroFacts;
  /** Injected in tests so a render is deterministic. In the app the clock is
   *  read ONCE, here at the boundary, and passed into the engine — the engine
   *  itself never calls a clock (INVARIANTS.md Absolute A). */
  now?: number;
}

export function MacroPanelIsland({ surah, ayahCount, facts, now }: MacroPanelIslandProps) {
  const selector = useCallback(() => getAllEvents(), []);
  const state = useLogState(selector, (rows) => rows.length === 0, [surah]);

  // ATOMIC renders no panel at all — and that is true before the log resolves,
  // so there is no skeleton flash for a panel that will never appear. The ayah
  // list on the page carries this surah's seams instead (v3-D21 / §A.3).
  if (facts.archetype === "ATOMIC") return null;

  if (state.status === "pending") return <Shell busy>{skeletonBody()}</Shell>;

  if (state.status === "broken") {
    return (
      <Shell>
        <p className="stub-note" role="status">
          Your progress could not be read on this device, so this map is not
          being drawn. Nothing has been lost — the log is on disk.
        </p>
      </Shell>
    );
  }

  // `empty` is a real answer, not a missing one: fold zero events and render
  // the complete graph with every mark honestly reading "Not started".
  const events: DrillEvent[] = state.status === "ready" ? state.data : [];
  const at = now ?? Date.now();
  const nodes = buildGraphNodes(surah, ayahCount, rebuild(events), at);

  return <MacroPanel surah={surah} facts={facts} nodes={nodes} />;
}

/** The card chrome, shared by the skeleton and the failure states so they
 *  occupy the same space the real panel will — no layout jump on resolve. */
function Shell({ children, busy = false }: { children: React.ReactNode; busy?: boolean }) {
  return (
    <section className="card" aria-labelledby={MACRO_HEADING_ID} aria-busy={busy || undefined}>
      <div className="card-header">
        <h2 id={MACRO_HEADING_ID} style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
          STRUCTURE
        </h2>
      </div>
      {children}
    </section>
  );
}

/** Skeletons, never zeros (#73). */
function skeletonBody() {
  return (
    <p className="caption">
      <span className="skel" aria-hidden="true" /> <span>Reading your progress…</span>
    </p>
  );
}
