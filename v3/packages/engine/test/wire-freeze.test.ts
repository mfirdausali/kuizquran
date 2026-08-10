// Build-plan step 10: the DrillEvent wire frozen ONCE, complete (v3-D10).
// New fields: surah (already existed), siteKey, visitOrdinal, deviceId,
// deviceSeq, tz, corpusHash, locale, a denormalized spec snapshot,
// positional answer (position+choice already existed — B6's fix already
// made this pair the position-scoped answer), gradeClass.
//
// WIREFRAME.md's "hard problem 1, solved": the fold never dereferences a
// spec id — the event carries VALUES, and rebuild.ts keeps reading `rung`
// exactly as before. gradeClass/specSnapshot are provenance ALONGSIDE the
// already-resolved rung, never a replacement for it, and rebuild.ts must
// have ZERO new branches reading them (proven below).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeEvent } from "../src/events.ts";
import { rebuild } from "../src/rebuild.ts";
import { siteKey } from "../src/site.ts";
import type { DrillEvent } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(HERE, "..", "src");

describe("makeEvent stamps every new wire field when provided", () => {
  it("round-trips surah/siteKey/visitOrdinal/deviceId/deviceSeq/tz/corpusHash/locale/gradeClass", () => {
    const site = { kind: "ayah" as const, surah: 12, ayah: 4 };
    const e = makeEvent({
      type: "rung_complete",
      ts: 1000,
      surah: 12,
      ayah: 4,
      rung: "S2",
      siteKey: siteKey(site),
      visitOrdinal: 3,
      deviceId: "device-abc",
      deviceSeq: 7,
      tz: "Asia/Kuala_Lumpur",
      corpusHash: "875a4a0230b9c69d",
      locale: "en",
      gradeClass: "s2_partial",
      specSnapshot: { lane: "cloze", variantId: "v1" },
    });
    expect(e.siteKey).toBe("12:ayah:4");
    expect(e.visitOrdinal).toBe(3);
    expect(e.deviceId).toBe("device-abc");
    expect(e.deviceSeq).toBe(7);
    expect(e.tz).toBe("Asia/Kuala_Lumpur");
    expect(e.corpusHash).toBe("875a4a0230b9c69d");
    expect(e.locale).toBe("en");
    expect(e.gradeClass).toBe("s2_partial");
    expect(e.specSnapshot).toEqual({ lane: "cloze", variantId: "v1" });
  });

  it("omits every new field when not provided (no silent defaults)", () => {
    const e = makeEvent({ type: "rung_complete", ts: 1000, surah: 12, ayah: 4, rung: "S2" });
    expect(e.siteKey).toBeUndefined();
    expect(e.visitOrdinal).toBeUndefined();
    expect(e.deviceId).toBeUndefined();
    expect(e.deviceSeq).toBeUndefined();
    expect(e.tz).toBeUndefined();
    expect(e.corpusHash).toBeUndefined();
    expect(e.locale).toBeUndefined();
    expect(e.gradeClass).toBeUndefined();
    expect(e.specSnapshot).toBeUndefined();
  });
});

describe("hard problem 1 (WIREFRAME.md §22): the fold never dereferences the new fields", () => {
  it("rebuild() folds a fully-populated event identically to a bare one with the same graded facts", () => {
    const bare: DrillEvent = {
      type: "rung_complete",
      ts: 1000,
      surah: 12,
      ayah: 4,
      rung: "S2",
      correct: true,
      structured: true,
    };
    const decorated: DrillEvent = {
      ...bare,
      siteKey: "12:ayah:4",
      visitOrdinal: 5,
      deviceId: "device-xyz",
      deviceSeq: 12,
      tz: "Asia/Kuala_Lumpur",
      corpusHash: "875a4a0230b9c69d",
      locale: "ms",
      gradeClass: "s2_partial",
      specSnapshot: { lane: "cloze", variantId: "v9", anything: "the fold must never read this" },
    };
    const foldedBare = rebuild([bare]);
    const foldedDecorated = rebuild([decorated]);
    expect([...foldedDecorated.entries()]).toEqual([...foldedBare.entries()]);
  });

  // golden-log-parity.test.ts already proves the pre-freeze golden log
  // (no new fields) folds to the exact committed oracle — not duplicated
  // here to avoid a second, unpinned TZ=UTC dependency in this file.

  it("rebuild.ts never reads specSnapshot/siteKey/visitOrdinal/deviceId/deviceSeq/corpusHash/locale/gradeClass (structural, so a future regression fails loud)", () => {
    const content = readFileSync(resolve(SRC_DIR, "rebuild.ts"), "utf8");
    const codeOnly = content
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    for (const field of [
      "specSnapshot",
      "siteKey",
      "visitOrdinal",
      "deviceId",
      "deviceSeq",
      "corpusHash",
      "locale",
      "gradeClass",
    ]) {
      expect(codeOnly.includes(field), `rebuild.ts must never reference "${field}"`).toBe(false);
    }
  });
});
