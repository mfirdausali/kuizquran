import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceReconstruct,
  blankCountFor,
  initReconstruct,
  nextReconstructItem,
} from "../src/reconstruct.ts";
import type { Corpus, DrillItem, LadderDone } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../public/corpus/12.json"), "utf8"),
) as Corpus;

const AYAH = 4; // 12:4 — 15 words
function words() {
  return corpus.words.filter((w) => w.ayah === AYAH).sort((a, b) => a.position - b.position);
}

function rc(item: DrillItem | LadderDone): Extract<DrillItem, { rung: "RC" }> {
  if ("done" in item) throw new Error("expected an RC item, got done");
  if (item.rung !== "RC") throw new Error(`expected RC, got ${item.rung}`);
  return item;
}

describe("blankCountFor — auto-scales with strength band (v2-D05)", () => {
  it("Learn band (<40): a single blank", () => {
    expect(blankCountFor(0, 15)).toBe(1);
    expect(blankCountFor(39, 15)).toBe(1);
  });

  it("Reinforce band (40–80): about half the ayah", () => {
    expect(blankCountFor(40, 15)).toBe(8); // ceil(15/2)
    expect(blankCountFor(79, 10)).toBe(5);
  });

  it("Carry band (≥80): the whole ayah — full production, matching S3", () => {
    expect(blankCountFor(80, 15)).toBe(15);
    expect(blankCountFor(100, 15)).toBe(15);
  });

  it("never exceeds the ayah's word count", () => {
    expect(blankCountFor(100, 1)).toBe(1);
    expect(blankCountFor(0, 0)).toBe(0);
  });
});

describe("tap-to-reconstruct — grounded in the whole ayah (v2-D23)", () => {
  it("Learn band: one blank at the ayah's tail, rest of the ayah still shown", () => {
    const state = initReconstruct(corpus, 12, AYAH, 0);
    expect(state.blankPositions).toEqual([15]); // last word only
    const item = rc(nextReconstructItem(state, corpus));
    expect(item.ayahWords).toHaveLength(15); // whole verse always present
    expect(item.currentBlank).toBe(15);
    expect(item.full).toBe(false);
    expect(item.options).toContain(item.correct);
  });

  it("Carry band: the whole ayah is blanked — full production", () => {
    const state = initReconstruct(corpus, 12, AYAH, 85);
    expect(state.blankPositions).toEqual(words().map((w) => w.position));
    const item = rc(nextReconstructItem(state, corpus));
    expect(item.full).toBe(true);
    expect(item.currentBlank).toBe(1); // first→last, same order as old S3
  });

  it("a wrong tap is a slip — does not advance the blank", () => {
    const state = initReconstruct(corpus, 12, AYAH, 0);
    const item = rc(nextReconstructItem(state, corpus));
    const wrong = item.options.find((o) => o !== item.correct) ?? "not-a-real-option";
    const r = advanceReconstruct(state, corpus, wrong);
    expect(r.correct).toBe(false);
    expect(r.ayahProduced).toBeUndefined();
    expect(r.state.blankIndex).toBe(0);
    // still the same blank next time
    const again = rc(nextReconstructItem(r.state, corpus));
    expect(again.currentBlank).toBe(item.currentBlank);
  });

  it("Learn band: the single correct tap completes the pass (ayahProduced, not full)", () => {
    const state = initReconstruct(corpus, 12, AYAH, 0);
    const item = rc(nextReconstructItem(state, corpus));
    const r = advanceReconstruct(state, corpus, item.correct);
    expect(r.correct).toBe(true);
    expect(r.ayahProduced).toBe(true);
    expect(r.full).toBe(false);
  });

  it("Carry band: blanks fill strictly in ascending (reading) order, last tap completes as full", () => {
    let state = initReconstruct(corpus, 12, AYAH, 85);
    const n = words().length;
    let guard = 0;
    let sawOrder: number[] = [];
    let lastResult: ReturnType<typeof advanceReconstruct> | undefined;
    while (guard++ < n + 5) {
      const item = nextReconstructItem(state, corpus);
      if ("done" in item) break;
      sawOrder.push(item.currentBlank);
      lastResult = advanceReconstruct(state, corpus, item.correct);
      state = lastResult.state;
    }
    expect(sawOrder).toEqual(words().map((w) => w.position)); // first→last, invariant #1
    expect(lastResult!.ayahProduced).toBe(true);
    expect(lastResult!.full).toBe(true);
    expect(nextReconstructItem(state, corpus)).toEqual({ done: true });
  });
});
