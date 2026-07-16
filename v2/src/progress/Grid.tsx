// The flat, mushaf-faithful 1->N grid — the detail zoom level (v2-D25):
// "which exact ayat do I hold?" Grouped/tinted by movement when the surah has
// an authored ring (v2-D24); otherwise a plain uniform grid (v2-D29's universal
// fallback for a surah with no structure map). Tapping a cell opens that ayah's
// drill. When a movement is selected on the Ring above, its cells are
// highlighted and the rest dim (v2-D25's "tap an arc -> drill into its cells").
import { Link } from "react-router-dom";
import type { HeatmapRow } from "engine";
import { movementForAyah } from "./movements.ts";

export function Grid({
  surah,
  rows,
  selectedMovement,
}: {
  surah: number;
  rows: HeatmapRow[];
  selectedMovement: number | null;
}) {
  return (
    <div className="grid-progress" role="group" aria-label={`Ayah-by-ayah progress, surah ${surah}`}>
      {rows.map((r) => {
        const movement = movementForAyah(surah, r.ayah);
        const inSelected = selectedMovement === null || movement?.id === selectedMovement;
        const cls = ["grid-cell", inSelected ? "is-in-movement" : "is-dimmed"].join(" ");
        return (
          <Link
            key={r.ayah}
            to={`/drill?ayah=${r.ayah}`}
            className={cls}
            style={{ background: r.encoded ? `color-mix(in srgb, var(--teal-600) ${r.strength}%, var(--surface-2))` : "var(--surface-2)" }}
            title={`12:${r.ayah} — ${r.encoded ? `${r.strength}%` : "not learned"}`}
          >
            {r.ayah}
          </Link>
        );
      })}
    </div>
  );
}
