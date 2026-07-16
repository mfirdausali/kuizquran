// Per-surah structure maps (v2-D24/D25, v2-D29). The engine stays surah-
// agnostic (invariant-adjacent: no hardcoded 12 in engine/*); this narrative
// structure — the 12-movement chiastic RING that's Sūrat Yūsuf's own overview —
// lives here, at the app layer, keyed by surah number. A surah with no authored
// map (everything but 12, for now) has no ring; the flat 1→N grid is the
// universal fallback (v2-D29) — see Grid.tsx.

export interface Movement {
  id: number;
  label: string;
  ayahFrom: number;
  ayahTo: number;
  /** The mirrored movement across the pivot (6↔7), or null for the pivot itself
   *  isn't null — 6 and 7 mirror each other too; see v2-D24. */
  mirrorOf: number;
}

/** Sūrat Yūsuf's 12 narrative movements (v2-D24) — real ayah ranges, covering
 *  all 111 ayat. Mirror pairs around the pivot (6↔7, the king's dream):
 *  1↔12 dream→fulfilled · 2↔11 plot→lesson · 3↔10 seduce→confess ·
 *  4↔9 ladies→confess · 5↔8 jail→released. Movements 9/10 sit at 50–53,
 *  narratively before release #8 at 54–57 — the women confess during the
 *  recall block; narrative order ≠ strict ayah order at the pivot (a property
 *  of the ring, not a bug — see DECISIONS.md v2-D24). */
export const YUSUF_MOVEMENTS: Movement[] = [
  { id: 1, label: "Dream", ayahFrom: 1, ayahTo: 6, mirrorOf: 12 },
  { id: 2, label: "Plot", ayahFrom: 7, ayahTo: 20, mirrorOf: 11 },
  { id: 3, label: "Seduce", ayahFrom: 21, ayahTo: 29, mirrorOf: 10 },
  { id: 4, label: "Ladies", ayahFrom: 30, ayahTo: 34, mirrorOf: 9 },
  { id: 5, label: "Jail", ayahFrom: 35, ayahTo: 42, mirrorOf: 8 },
  { id: 6, label: "King's Dream", ayahFrom: 43, ayahTo: 45, mirrorOf: 7 },
  { id: 7, label: "Recall", ayahFrom: 46, ayahTo: 49, mirrorOf: 6 },
  { id: 8, label: "Released", ayahFrom: 54, ayahTo: 57, mirrorOf: 5 },
  { id: 9, label: "Confess", ayahFrom: 50, ayahTo: 51, mirrorOf: 4 },
  { id: 10, label: "Confess", ayahFrom: 52, ayahTo: 53, mirrorOf: 3 },
  { id: 11, label: "Lesson", ayahFrom: 58, ayahTo: 98, mirrorOf: 2 },
  { id: 12, label: "Fulfilled", ayahFrom: 99, ayahTo: 111, mirrorOf: 1 },
];

const SURAH_MOVEMENTS: Record<number, Movement[]> = { 12: YUSUF_MOVEMENTS };

/** The authored structure map for a surah, or null if it has none yet (v2-D29's
 *  flat-grid fallback applies). */
export function movementsFor(surah: number): Movement[] | null {
  return SURAH_MOVEMENTS[surah] ?? null;
}

/** Which movement an ayah falls in, or null (no map, or out of range). */
export function movementForAyah(surah: number, ayah: number): Movement | null {
  const list = movementsFor(surah);
  if (!list) return null;
  return list.find((m) => ayah >= m.ayahFrom && ayah <= m.ayahTo) ?? null;
}
