// THE SERVER CORPUS LOADER — `lib/corpus/load.ts` (build-plan step 20 / HANDOVER.md §A-note).
//
// ---------------------------------------------------------------------------
// THE DEFECT THIS PINS
// ---------------------------------------------------------------------------
// `/drill`, `/plan`, `/progress`, `/progress/list`, `/surah/[surah]`,
// `/surah/[surah]/[ayah]` and `/workbench` all read `loadCorpus`/
// `AVAILABLE_SURAHS` from this module. Before this fix it read
// `packages/engine/test/fixtures/12.json` — the engine's own, UNFROZEN test
// fixture, cut before v3-D60's foil redraw and carrying no `hashSpecVersion`.
// A learner reaching any of those routes was served content the qari's
// tiered-hash sign-off (v3-D13/v3-D22) can never certify, because the served
// bytes are not the bytes the hash was ever computed over.
//
// So this test pins TWO things: that `AVAILABLE_SURAHS` covers the actual
// launch set (`v3/scripts/content-freeze.mjs#LAUNCH_SURAHS`), and that
// `loadCorpus` reads the FROZEN, compiled, hashed artifact — proven by a
// byte-identical comparison against `packages/corpus-compiler/output/`, not
// merely by "it returns something".
//
// NOT ONE ARABIC BYTE IS TYPED HERE. Every string this file touches is read
// from the compiled corpus at runtime.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { loadCorpus, AVAILABLE_SURAHS } from "@/lib/corpus/load.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_ROOT = resolve(HERE, "../../../packages/corpus-compiler/output");

// The same four surahs `content-freeze.mjs#LAUNCH_SURAHS` enumerates
// (v3-D59/v3-D63). Not re-imported from there: that script is a CLI entry
// point (`process.argv`-driven), not a module built to be imported by a test.
const LAUNCH_SURAHS = [12, 67, 103, 112] as const;

describe("AVAILABLE_SURAHS covers the launch set, not a single fixture surah", () => {
  it("matches the four surahs the content-freeze gate enumerates", () => {
    for (const surah of LAUNCH_SURAHS) {
      expect(AVAILABLE_SURAHS, `surah ${surah} missing from AVAILABLE_SURAHS`).toContain(surah);
    }
    expect(AVAILABLE_SURAHS.length).toBe(LAUNCH_SURAHS.length);
  });

  it("still refuses a surah nobody compiled", () => {
    expect(AVAILABLE_SURAHS).not.toContain(999);
  });
});

describe("loadCorpus reads the FROZEN compiled artifact, never the engine's test fixture", () => {
  for (const surah of LAUNCH_SURAHS) {
    it(`surah ${surah}: byte-identical to packages/corpus-compiler/output/${surah}/corpus.json`, async () => {
      const outPath = resolve(OUTPUT_ROOT, String(surah), "corpus.json");
      if (!existsSync(outPath)) {
        throw new Error(
          `No compiled corpus at ${outPath}. Run \`make compile-corpus\` first ` +
            `— output/ is gitignored (v3-D52), so a clean checkout must build it.`,
        );
      }
      const expected = JSON.parse(readFileSync(outPath, "utf8"));
      const actual = await loadCorpus(surah);
      expect(actual).not.toBeNull();
      // Byte-identical, not merely "same shape" — a shape-only check would
      // stay green even if loadCorpus re-derived or truncated the corpus.
      expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    });
  }

  it("surah 12 carries hashSpecVersion 1 — proof it is the hashed artifact, not the unhashed engine fixture", async () => {
    const corpus = await loadCorpus(12);
    expect(corpus).not.toBeNull();
    // The engine's own `Corpus['meta']` type is deliberately narrow (surah/
    // ayahCount/wordCount only — v3-D08 keeps compiler-only fields out of the
    // spine), so the compiler's extra meta fields are read through a cast
    // rather than widening the engine's public type for one test. The stale
    // engine fixture (packages/engine/test/fixtures/12.json) has no such field
    // at all — this assertion fails against it by construction.
    const meta = (corpus as unknown as { meta: { hashSpecVersion?: number } }).meta;
    expect(meta.hashSpecVersion).toBe(1);
  });

  it("returns null for a surah outside the launch set, never a throw", async () => {
    await expect(loadCorpus(999)).resolves.toBeNull();
  });
});
