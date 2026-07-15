import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bridgeItems, nextOpening, birthConnection, BRIDGE_OPENING_COUNT } from "../src/bridge.ts";
import { initAtom, type AtomState } from "../src/atom.ts";
import type { Corpus } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../public/corpus.json"), "utf8"),
) as Corpus;

describe("S4 bridge 12:4 → 12:5", () => {
  it("probes the NEXT ayah's opening words", () => {
    const opening = nextOpening(corpus, 4);
    expect(opening).toHaveLength(BRIDGE_OPENING_COUNT);
    // All from ayah 5, in reading order.
    expect(opening.every((w) => w.ayah === 5)).toBe(true);
    expect(opening.map((w) => w.position)).toEqual([1, 2, 3]);
  });

  it("builds valid meaning items (correct + 3 distinct distractors)", () => {
    const items = bridgeItems(corpus, 4);
    expect(items).toHaveLength(BRIDGE_OPENING_COUNT);
    for (const it of items) {
      expect(it.rung).toBe("S4");
      expect(it.fromAyah).toBe(4);
      expect(it.toAyah).toBe(5);
      expect(it.options).toContain(it.correct);
      expect(new Set(it.options).size).toBe(it.options.length); // no dupes
      expect(it.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("births the connection atom for n (ref = from ayah), idempotently", () => {
    const atoms = new Map<string, AtomState>();
    const born = birthConnection(atoms, 4);
    expect(born.kind).toBe("connection");
    expect(born.ref).toBe(4);
    expect(atoms.get("connection:4")).toBeDefined();
    // idempotent: second call returns the same, doesn't reset
    const mutated = { ...born, strength: 42 };
    atoms.set("connection:4", mutated);
    const again = birthConnection(atoms, 4);
    expect(again.strength).toBe(42);
  });
});
