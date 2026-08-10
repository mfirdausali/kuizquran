// Coordinates only — no Quranic Arabic anywhere in this file (v3/INVARIANTS.md
// Absolute B).

import { describe, expect, it } from "vitest";
import { buildConnections } from "../src/connections.ts";

describe("buildConnections — surah-parameterized (E-01)", () => {
  it("emits ayahCount - 1 connections, each stamped with the given surah", () => {
    const conns = buildConnections(12, 5);
    expect(conns).toHaveLength(4);
    for (const c of conns) expect(c.surah).toBe(12);
    expect(conns.map((c) => [c.from, c.to])).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ]);
  });

  it("two surahs with overlapping ayah numbers produce distinguishable connection rows", () => {
    // Yusuf (12) and a second surah both have a 1->2 connection. Without the
    // surah field these would be indistinguishable — the exact E-01 collision
    // v3/DEFECTS.md names.
    const a = buildConnections(12, 3);
    const b = buildConnections(103, 3);
    const key = (c: { surah: number; from: number; to: number }) => `${c.surah}:${c.from}:${c.to}`;
    const keysA = new Set(a.map(key));
    const keysB = new Set(b.map(key));
    for (const k of keysB) expect(keysA.has(k)).toBe(false);
  });

  it("a surah with 1 ayah produces zero connections (degenerate case, not an error)", () => {
    expect(buildConnections(999, 1)).toEqual([]);
  });
});
