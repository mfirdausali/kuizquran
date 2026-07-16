// The 12-movement ring — the overview zoom level of the progress map (v2-D24/
// D25): "where am I in the story?" Tap an arc to drill into its ayat on the
// Grid below. Each arc is tinted by the movement's average strength (the same
// teal ramp .meter already uses) — not a literal SVG pie, 12 real tap targets
// (>=44px, v2-D28) placed on a circle via simple trigonometry.
import { useMemo } from "react";
import type { HeatmapRow } from "engine";
import type { Movement } from "./movements.ts";

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 108;

function avgStrength(rows: HeatmapRow[], m: Movement): number {
  const inRange = rows.filter((r) => r.ayah >= m.ayahFrom && r.ayah <= m.ayahTo);
  if (inRange.length === 0) return 0;
  return inRange.reduce((s, r) => s + r.strength, 0) / inRange.length;
}

export function Ring({
  movements,
  rows,
  selected,
  onSelect,
}: {
  movements: Movement[];
  rows: HeatmapRow[];
  selected: number | null;
  onSelect: (id: number | null) => void;
}) {
  const arcs = useMemo(
    () =>
      movements.map((m, i) => {
        const angle = (i / movements.length) * 2 * Math.PI - Math.PI / 2;
        const x = CENTER + RADIUS * Math.cos(angle);
        const y = CENTER + RADIUS * Math.sin(angle);
        return { m, x, y, strength: avgStrength(rows, m) };
      }),
    [movements, rows],
  );

  const overall = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.strength, 0) / rows.length) : 0;

  return (
    <div className="ring" role="group" aria-label="Story ring — 12 narrative movements">
      {arcs.map(({ m, x, y, strength }) => (
        <button
          key={m.id}
          type="button"
          className={"ring-arc" + (selected === m.id ? " is-selected" : "")}
          style={{ left: x, top: y, background: `color-mix(in srgb, var(--teal-600) ${Math.round(strength)}%, var(--teal-100))` }}
          onClick={() => onSelect(selected === m.id ? null : m.id)}
          title={`${m.label} · 12:${m.ayahFrom}-${m.ayahTo}`}
        >
          {m.id}
        </button>
      ))}
      <div className="ring-center">
        <div>{overall}%</div>
        <div className="caption">overall</div>
      </div>
    </div>
  );
}
