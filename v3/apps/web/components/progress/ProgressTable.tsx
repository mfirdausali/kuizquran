"use client";

// THE PROGRESS TABLE — the ring's documented text alternative (WIREFRAME §15).
//
// ---------------------------------------------------------------------------
// A REAL <table>, AND WHY THAT IS A REQUIREMENT RATHER THAN A PREFERENCE
// ---------------------------------------------------------------------------
// §15: "Semantic <table> with real headers, not a grid of <div>s — so a screen
// reader announces 'Ayah 3, lapsed, 48%'."
//
// That utterance is produced by the ACCESSIBILITY TREE, not by the layout. A
// CSS grid of divs can be made to look identical and will announce an
// undifferentiated wall of cells, because nothing tells the reader which
// column a cell is in. The three things that produce the utterance:
//
//   - <th scope="col"> on every column header, so each cell knows its column;
//   - <th scope="row"> as the FIRST cell of every row, so the reference is
//     announced together with every other cell in that row;
//   - a <caption>, so the table announces what it is before it is entered.
//
// This is why the table is queried by ROLE in its tests. A class-based
// assertion would keep passing after someone "modernised" the markup into
// divs, which is the one regression the tests exist to catch.
//
// ---------------------------------------------------------------------------
// WHY THIS COMPONENT COMPUTES NOTHING
// ---------------------------------------------------------------------------
// Every cell below prints a field of `ProgressRow`. Not one comparison, not
// one threshold, not one band. `lib/progress/rows.ts` made all of those
// decisions, which is what keeps check-boundaries.mjs clause 5 satisfied in
// substance and not merely in letter. Sorting and filtering are likewise
// imported, not implemented here.
//
// It is a CLIENT component only because sorting and searching are interactive.
// It reads no IndexedDB itself — rows arrive as a prop, so a server render of
// this table would paint exactly what the client paints (edge case #72).

import { useMemo, useState, useId } from "react";
import {
  filterRows,
  sortRows,
  type ProgressRow,
  type SortColumn,
  type SortDirection,
} from "@/lib/progress/rows";
import { StageBadge } from "./StageBadge";

/** The eight columns, in order. `sort` names the comparator; `numeric` right-
 *  aligns the cell. `Kind` is a column of its own because after a sort by
 *  strength the rows interleave and the arrow inside the reference is no
 *  longer a reliable way to tell a joint from an ayah (edge case #90). */
const COLUMNS: ReadonlyArray<{
  key: SortColumn;
  label: string;
  numeric?: boolean;
}> = [
  { key: "reference", label: "Item" },
  { key: "text", label: "Text", numeric: true },
  { key: "kind", label: "Kind" },
  { key: "stage", label: "Stage" },
  { key: "strength", label: "Strength", numeric: true },
  { key: "halfLife", label: "Half-life", numeric: true },
  { key: "next", label: "Next", numeric: true },
  { key: "time", label: "Time on task", numeric: true },
];

interface ProgressTableProps {
  rows: readonly ProgressRow[];
}

export function ProgressTable({ rows }: ProgressTableProps) {
  // Default: reference ascending — which is expand() order, so the FIRST thing
  // a learner sees is the memory graph in reading order with the joints
  // already interleaved between the ayat. No control has to be touched for
  // the seams to be visible.
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "reference",
    direction: "ascending",
  });
  const [query, setQuery] = useState("");
  const searchId = useId();
  const statusId = useId();

  const visible = useMemo(
    () => sortRows(filterRows(rows, query), sort.column, sort.direction),
    [rows, query, sort],
  );

  const toggle = (column: SortColumn) =>
    setSort((s) =>
      s.column === column
        ? { column, direction: s.direction === "ascending" ? "descending" : "ascending" }
        : { column, direction: "ascending" },
    );

  return (
    <div className="stack stack--tight">
      {/* A VISIBLE <label>, not a placeholder. Placeholder-as-label is the
          other classic a11y failure in a table toolbar: it disappears the
          moment you type, and it is not reliably announced. */}
      <div className="table-toolbar">
        <label className="table-toolbar__label" htmlFor={searchId}>
          Search ayat and joints
        </label>
        <input
          id={searchId}
          type="search"
          className="table-toolbar__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-describedby={statusId}
        />
      </div>

      {/* A live region, so a screen-reader user learns the filter did
          something rather than silently losing rows. */}
      <p id={statusId} className="caption" aria-live="polite">
        {visible.length} of {rows.length} items
      </p>

      {/* Wide content scrolls INSIDE its own container — the page body must
          never scroll horizontally. */}
      <div className="table-scroll">
        <table className="progress-table">
          <caption className="sr-only">
            Every ayah and every joint you are memorising, with its stage,
            strength, half-life, next review and time on task. Time on task is
            the time actually spent answering — interrupted items are
            discarded, so a session you walked away from never makes you look
            slower than you were.
          </caption>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  // The attribute a screen reader announces. Omitting it is
                  // the most common way a "sortable table" turns out to be
                  // sortable only for sighted mouse users.
                  aria-sort={sort.column === col.key ? sort.direction : "none"}
                  className={col.numeric ? "col--numeric" : undefined}
                >
                  <button
                    type="button"
                    className="th-sort"
                    onClick={() => toggle(col.key)}
                  >
                    {col.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} data-kind={row.kind}>
                {/* The row header. This is what makes every other cell in the
                    row announce as "12:3, lapsed, 48%" rather than as a bare
                    value. Latin digits inside an LTR island so the reference
                    never reorders beside the Arabic cell next to it. */}
                <th scope="row" className="progress-table__ref">
                  <span className="ltr-island">{row.reference}</span>
                </th>

                {/* The ONLY RTL cell in the row. dir and lang are on the cell
                    itself, never on the <tr>: §15 calls mixed-direction rows
                    "the classic bug here", and the fix is isolation at the
                    smallest possible scope. `.rtl-island` carries
                    unicode-bidi: isolate so neighbours cannot leak in — the
                    class is the paint, the attributes are the meaning. */}
                <td dir="rtl" lang="ar" className="rtl-island">
                  {row.text}
                </td>

                {/* A WORD. Edge case #90's fix in the table: after a sort by
                    strength this is the only thing distinguishing a joint. */}
                <td>{row.kindLabel}</td>

                <td>
                  <StageBadge
                    stage={row.stage}
                    stageLabel={row.stageLabel}
                    strengthPct={row.strengthPct}
                    valueLabel={row.strengthLabel}
                  />
                </td>

                <td className="col--numeric">{row.strengthLabel}</td>
                <td className="col--numeric">{row.halfLifeLabel}</td>
                <td className="col--numeric">{row.nextLabel}</td>
                <td className="col--numeric">{row.timeOnTask}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* A TRUE empty state, never a blank <tbody>. The three-state discipline
          (#73): pending paints skeletons, empty says so in words. */}
      {visible.length === 0 && (
        <div className="stub-note" role="status">
          No items match &ldquo;{query}&rdquo;.{" "}
          {/* `btn--ghost` is the locked quiet modifier (iman-ui.css:338). This
              read `btn--quiet` — a class NO stylesheet defines, so the button
              rendered as a full-width default `.btn` mid-sentence rather than
              the inline quiet control it is meant to be. `hit` supplies the
              44px floor, as every other bare control in the app does. */}
          <button type="button" className="btn btn--ghost hit" onClick={() => setQuery("")}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
