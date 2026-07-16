import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chainSteps, junctionItem, applyChain, type ChainStepResult } from "../src/chain.ts";
import { initAtom, atomKey, type AtomState } from "../src/atom.ts";
import type { Corpus } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../public/corpus/12.json"), "utf8"),
) as Corpus;
const DAY = 86_400_000;

describe("chainSteps", () => {
  it("[4,5] = ayah 4, junction 4→5, ayah 5", () => {
    expect(chainSteps(4, 5)).toEqual([
      { kind: "ayah", ref: 4 },
      { kind: "junction", from: 4, to: 5 },
      { kind: "ayah", ref: 5 },
    ]);
  });

  it("[4,6] traverses 3 ayat and 2 junctions", () => {
    const steps = chainSteps(4, 6);
    expect(steps.filter((s) => s.kind === "ayah")).toHaveLength(3);
    expect(steps.filter((s) => s.kind === "junction")).toHaveLength(2);
  });
});

describe("junctionItem", () => {
  it("correct = the opening of the target ayah; options are distinct openings", () => {
    const j = junctionItem(corpus, 4, 5);
    const opening5 = corpus.words.find((w) => w.ayah === 5 && w.position === 1)!.text_uthmani;
    expect(j.correct).toBe(opening5);
    expect(j.options).toContain(j.correct);
    expect(new Set(j.options).size).toBe(j.options.length);
  });
});

describe("applyChain — FIRe credit (D17: breadth, not extra weight)", () => {
  function atomsWith(...refs: [string, number][]): Map<string, AtomState> {
    const m = new Map<string, AtomState>();
    for (const [kind, ref] of refs) {
      const a = initAtom(kind as "ayah" | "connection", ref);
      // encoded: true — these atoms represent ayat already taught (S3) / connections
      // already born (S4), the only atoms a chain is allowed to credit (v2-BUG-3).
      m.set(atomKey(kind as "ayah" | "connection", ref), {
        ...a,
        strength: 40,
        stability: 3,
        lastRetrieval: 3 * DAY,
        encoded: true,
      });
    }
    return m;
  }

  it("a clean chain over [4,5] credits ayah 4, connection 4→5, AND ayah 5 in one pass", () => {
    const before = atomsWith(["ayah", 4], ["connection", 4], ["ayah", 5]);
    const results: ChainStepResult[] = chainSteps(4, 5).map((step) => ({ step, correct: true }));
    const after = applyChain(before, results, 10 * DAY);
    for (const key of ["ayah:4", "connection:4", "ayah:5"]) {
      const b = before.get(key)!;
      const a = after.get(key)!;
      expect(a.strength, key).toBeGreaterThan(b.strength); // every traversed atom credited
      expect(a.reps, key).toBe(b.reps + 1);
    }
  });

  it("an error on any step never raises that atom's strength (property)", () => {
    const before = atomsWith(["ayah", 4], ["connection", 4], ["ayah", 5]);
    // Fail the junction step only.
    const results: ChainStepResult[] = chainSteps(4, 5).map((step) => ({
      step,
      correct: step.kind !== "junction",
    }));
    const after = applyChain(before, results, 10 * DAY);
    // The connection (junction) atom must not have gained strength.
    expect(after.get("connection:4")!.strength).toBeLessThanOrEqual(before.get("connection:4")!.strength);
    // The correctly-recalled ayat still gained.
    expect(after.get("ayah:4")!.strength).toBeGreaterThan(before.get("ayah:4")!.strength);
    expect(after.get("ayah:5")!.strength).toBeGreaterThan(before.get("ayah:5")!.strength);
  });

  it("v2-BUG-3 gap guard: a chain over a fresh run phantom-credits nothing", () => {
    const empty = new Map<string, AtomState>();
    const results: ChainStepResult[] = chainSteps(4, 5).map((step) => ({ step, correct: true }));
    const after = applyChain(empty, results, DAY);
    expect(after.get("ayah:4")).toBeUndefined();
    expect(after.get("connection:4")).toBeUndefined();
    expect(after.get("ayah:5")).toBeUndefined();
    expect(after.size).toBe(0);
  });

  it("v2-BUG-3 gap guard: an un-encoded ayah mid-chain is skipped, not phantom-credited", () => {
    // ayah 4 and its connection are real (already taught/born); ayah 5 was never
    // encoded (never completed S3) — a chain must not fabricate its credit.
    const before = atomsWith(["ayah", 4], ["connection", 4]);
    const results: ChainStepResult[] = chainSteps(4, 5).map((step) => ({ step, correct: true }));
    const after = applyChain(before, results, 10 * DAY);
    expect(after.get("ayah:4")!.strength).toBeGreaterThan(before.get("ayah:4")!.strength);
    expect(after.get("connection:4")!.strength).toBeGreaterThan(before.get("connection:4")!.strength);
    expect(after.get("ayah:5")).toBeUndefined();
  });
});
