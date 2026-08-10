// Build-plan step 7: E-01 surah-keying, DEFECTS.md's "hard blocker" — before
// this, `atomKey(kind, ref)` collides Yusuf ayah 5 with a second surah's ayah
// 5. This is the one mechanical commit through atom/rebuild/heatmap/
// scheduler/floor DEFECTS.md names, plus every raw-interpolation site it
// warns about ("five sites build keys by raw interpolation, and scheduler.ts
// never imports atomKey() at all — engine/src/scheduler.ts, engine/src/
// floor.ts"). Only structural coordinates are asserted — never Arabic text
// (v3/INVARIANTS.md Absolute B).

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { atomKey, initAtom, type AtomState } from "../src/atom.ts";
import { rebuild } from "../src/rebuild.ts";
import { birthConnection } from "../src/bridge.ts";
import { ayahHeatmap } from "../src/heatmap.ts";
import { assembleQueue } from "../src/scheduler.ts";
import { floorQueue } from "../src/floor.ts";
import type { Corpus, DrillEvent } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(HERE, "..", "src");

describe("atomKey is surah-scoped (DEFECTS.md#E-01)", () => {
  it("the exact collision DEFECTS.md names: Yusuf ayah 5 vs a second surah's ayah 5 never collide", () => {
    expect(atomKey(12, "ayah", 5)).not.toBe(atomKey(67, "ayah", 5));
  });

  it("format is `${surah}:${kind}:${ref}` (edge case #36)", () => {
    expect(atomKey(12, "ayah", 5)).toBe("12:ayah:5");
    expect(atomKey(12, "connection", 8)).toBe("12:connection:8");
  });

  it("AtomState carries a surah field, set by initAtom", () => {
    const a: AtomState = initAtom(12, "ayah", 5);
    expect(a.surah).toBe(12);
  });
});

describe("rebuild() surah-keys every atom it creates", () => {
  const eventFor = (surah: number): DrillEvent => ({
    type: "rung_complete",
    ts: 1000,
    surah,
    ayah: 5,
    rung: "S1",
    correct: true,
    structured: true,
  });

  it("two surahs sharing ayah 5 produce two DISTINCT atoms, not one collided atom", () => {
    const atoms = rebuild([eventFor(12), eventFor(67)]);
    expect(atoms.size).toBe(2);
    expect(atoms.get(atomKey(12, "ayah", 5))).toBeDefined();
    expect(atoms.get(atomKey(67, "ayah", 5))).toBeDefined();
    expect(atoms.get(atomKey(12, "ayah", 5))!.surah).toBe(12);
    expect(atoms.get(atomKey(67, "ayah", 5))!.surah).toBe(67);
  });

  it("a second surah's encode does not silently merge into the first surah's reps", () => {
    const atoms = rebuild([eventFor(12), eventFor(12), eventFor(67)]);
    expect(atoms.get(atomKey(12, "ayah", 5))!.reps).toBe(2);
    expect(atoms.get(atomKey(67, "ayah", 5))!.reps).toBe(1);
  });

  it("connection_born births a surah-scoped connection atom", () => {
    const atoms = rebuild([
      { type: "connection_born", ts: 1000, surah: 12, ayah: 8, to: 9, rung: "S4" },
      { type: "connection_born", ts: 1000, surah: 67, ayah: 8, to: 9, rung: "S4" },
    ]);
    expect(atoms.size).toBe(2);
    expect(atoms.get(atomKey(12, "connection", 8))!.surah).toBe(12);
    expect(atoms.get(atomKey(67, "connection", 8))!.surah).toBe(67);
  });
});

describe("birthConnection is surah-scoped", () => {
  it("births distinct atoms for the same ref under different surahs", () => {
    const atoms = new Map<string, AtomState>();
    const a = birthConnection(atoms, 12, 4);
    const b = birthConnection(atoms, 67, 4);
    expect(a.surah).toBe(12);
    expect(b.surah).toBe(67);
    expect(atoms.size).toBe(2);
  });
});

describe("ayahHeatmap reads the corpus's own surah, never a hardcoded one", () => {
  it("looks up atoms under the corpus's surah, not surah 12 unconditionally", () => {
    const corpus: Corpus = { meta: { surah: 67, ayahCount: 2, wordCount: 0 }, verses: [], words: [], distractors: [] };
    const atoms = new Map<string, AtomState>([[atomKey(67, "ayah", 1), { ...initAtom(67, "ayah", 1), strength: 50, encoded: true }]]);
    const rows = ayahHeatmap(corpus, atoms, 0);
    expect(rows[0]!.strength).toBe(50); // found under surah 67's key, not silently 0
  });
});

describe("scheduler.ts and floor.ts never build atom keys by raw interpolation", () => {
  // DEFECTS.md's exact warning: "A commit that rewrites only atomKey() call
  // sites leaves these emitting unkeyed strings that silently fail to match.
  // A lookup miss, not a type error." — grep-enforced so it can't regress.
  it("no `${...kind...}:${...ref...}`-shaped template literal remains outside atom.ts", () => {
    const offenders: string[] = [];
    for (const file of readdirSync(SRC_DIR)) {
      if (!file.endsWith(".ts") || file === "atom.ts") continue;
      const content = readFileSync(resolve(SRC_DIR, file), "utf8");
      // Matches the OLD two-part `kind:ref` template shape specifically —
      // an interpolated `.kind`/`.ref` field pair (`` `${x.kind}:${x.ref}` ``)
      // or a literal "ayah"/"connection" prefix (`` `ayah:${n}` ``) — never a
      // generic `${a}:${b}` pattern, which also matches unrelated
      // ayah:position dedup keys (overrides.ts) that have nothing to do with
      // atom keys.
      if (/`\$\{[\w.]*\.kind\}:\$\{[\w.]*\.ref\}`|`(ayah|connection):\$\{/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("assembleQueue's atomKey fields resolve through the real atomKey() format", () => {
    const atoms: AtomState[] = [
      { ...initAtom(12, "ayah", 4), encoded: true, gatePassed: true, strength: 60, stability: 4, lastRetrieval: 0 },
    ];
    const q = assembleQueue({ surah: 12, atoms, now: 30 * 86_400_000, lastActiveDay: null, wordCounts: new Map() });
    for (const item of q) {
      expect(item.atomKey.startsWith("12:")).toBe(true);
    }
  });

  it("floorQueue's atomKey fields resolve through the real atomKey() format", () => {
    const atoms: AtomState[] = [
      { ...initAtom(12, "ayah", 4), encoded: true, gatePassed: true, strength: 60, stability: 4, lastRetrieval: 0 },
    ];
    const q = floorQueue(atoms, 30 * 86_400_000);
    for (const item of q) {
      expect(item.atomKey.startsWith("12:")).toBe(true);
    }
  });
});
