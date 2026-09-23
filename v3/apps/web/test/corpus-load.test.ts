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
    it(`surah ${surah}: identical to packages/corpus-compiler/output/${surah}/corpus.json, modulo v3-D245's morphology strip`, async () => {
      const outPath = resolve(OUTPUT_ROOT, String(surah), "corpus.json");
      if (!existsSync(outPath)) {
        throw new Error(
          `No compiled corpus at ${outPath}. Run \`make compile-corpus\` first ` +
            `— output/ is gitignored (v3-D52), so a clean checkout must build it.`,
        );
      }
      const expected = JSON.parse(readFileSync(outPath, "utf8"));
      // v3-D245: loadCorpus() now nulls lemma/root/class (GPL-licensed QAC
      // morphology, never meant to reach a browser). Mirror that exact
      // transformation on the raw file's own words before comparing, so this
      // stays byte-identical on every OTHER field — a shape-only check would
      // stay green even if loadCorpus re-derived or truncated something else.
      const expectedStripped = {
        ...expected,
        words: expected.words.map((w: Record<string, unknown>) => ({
          ...w,
          lemma: null,
          root: null,
          class: null,
        })),
      };
      const actual = await loadCorpus(surah);
      expect(actual).not.toBeNull();
      expect(JSON.stringify(actual)).toBe(JSON.stringify(expectedStripped));
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

// ---------------------------------------------------------------------------
// v3-D245 — QAC morphology (GPL-licensed, v3-D24) must never reach a browser
// via the SSR path either, not only the client-fetch path.
// ---------------------------------------------------------------------------
//
// `scripts/stage-corpus.mjs#stripMorphology` strips `lemma`/`root`/`class`
// from the CLIENT-FETCHED bundle (`public/corpus/*.json`), and
// `check-corpus-morphology.mjs` (gate 18) enforces that — but ONLY over
// files actually written under `public/`, by its own explicit design. This
// module (`loadCorpus`/`loadEffectiveCorpus`) is the SEPARATE SSR read path
// every server-rendered route uses (`/plan`, `/progress`, `/progress/list`,
// `/surah/[surah]`, `/surah/[surah]/[ayah]`, `/drill`, `/practice`,
// `/workbench`), and it read the raw compiled `output/<surah>/corpus.json`
// straight into a `"use client"` component's own prop
// (`PlanIsland`/`DrillPicker`/`SurahAyahListIsland`/`RetentionIsland`/
// `ProgressListIsland`/`PracticePicker`) — which Next.js serializes whole
// into the page's own RSC payload regardless of which fields that component
// actually reads. The gate that is supposed to guard this never looked here.
describe("loadCorpus never lets QAC morphology reach a browser via the SSR path (v3-D245)", () => {
  it("the RAW compiled artifact genuinely carries non-null lemma/root — proving this isn't a vacuous check", async () => {
    const outPath = resolve(OUTPUT_ROOT, "112", "corpus.json");
    if (!existsSync(outPath)) {
      throw new Error(`No compiled corpus at ${outPath}. Run \`make compile-corpus\` first.`);
    }
    const raw = JSON.parse(readFileSync(outPath, "utf8"));
    const withRoot = raw.words.filter((w: { root: unknown }) => w.root !== null);
    expect(withRoot.length).toBeGreaterThan(0);
  });

  for (const surah of LAUNCH_SURAHS) {
    it(`surah ${surah}: loadCorpus() carries no lemma/root/class value on any word`, async () => {
      const corpus = await loadCorpus(surah);
      expect(corpus).not.toBeNull();
      for (const w of corpus!.words) {
        expect(w.lemma).toBeNull();
        expect(w.root).toBeNull();
        expect(w.class).toBeNull();
      }
    });
  }

  it("does not touch anything else — text_uthmani, gloss and line are untouched", async () => {
    const outPath = resolve(OUTPUT_ROOT, "112", "corpus.json");
    const raw = JSON.parse(readFileSync(outPath, "utf8"));
    const corpus = await loadCorpus(112);
    expect(corpus).not.toBeNull();
    for (let i = 0; i < raw.words.length; i++) {
      expect(corpus!.words[i]!.text_uthmani).toBe(raw.words[i].text_uthmani);
      expect(corpus!.words[i]!.gloss).toEqual(raw.words[i].gloss);
      expect(corpus!.words[i]!.line).toBe(raw.words[i].line);
    }
  });
});
