// THE AMIRI GLYPH-COVERAGE GATE (BUILD-PLAN "Remaining launch-checklist
// gates" — LAUNCH-CHECKLIST.md gate 21).
//
// ---------------------------------------------------------------------------
// WHY THE TESTS SPAWN THE REAL SCRIPT
// ---------------------------------------------------------------------------
// `content-freeze-gate.test.ts` already states this build's rule: "A gate is
// only worth its exit code. Testing an extracted helper would prove the
// helper works while the SCRIPT... could stop calling it." Every test below
// runs `check-corpus-glyphs.mjs` the way `npm run gates` runs it, against
// either the real shipped fonts and real compiled corpus, or a synthetic
// fixture tree in a temp directory, and asserts on stdout/exit code only.
//
// NOT ONE ARABIC BYTE IS WRITTEN HERE. Synthetic corpus fixtures below build
// their Arabic-range text via `String.fromCodePoint(...)`, the same technique
// `b6-repeated-word-sweep.test.ts` and `arabic.ts`'s own `TATWEEL` constant
// use — codepoint arithmetic, never a literal glyph.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(WEB_ROOT, "scripts/check-corpus-glyphs.mjs");
const REAL_OUTPUT_ROOT = path.resolve(WEB_ROOT, "../../packages/corpus-compiler/output");
const REAL_FONTS = [
  path.join(WEB_ROOT, "public/fonts/amiri-400.woff2"),
  path.join(WEB_ROOT, "public/fonts/amiri-700.woff2"),
];
const LAUNCH_SURAHS = [12, 67, 103, 112];

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

/** Uses spawnSync (not execFileSync) so stderr is captured on EVERY exit
 *  code — including 0, where the script's "SKIPPED"/warning lines go, which
 *  execFileSync would silently drop on the success path. */
function run(args: string[]): { out: string; code: number } {
  const r = spawnSync("node", [SCRIPT, ...args], { encoding: "utf8" });
  return { out: (r.stdout ?? "") + (r.stderr ?? ""), code: r.status ?? 1 };
}

/** Writes a minimal corpus.json under a fresh temp output/<surah>/ dir and
 *  returns [tempRoot, "--surahs", "<surah>"] — always pass through the
 *  fixture's own surah number, since the script otherwise looks for the
 *  real launch set (12/67/103/112) under the (empty) temp root. */
function fixtureCorpusArgs(surah: number, corpus: unknown): string[] {
  const dir = mkdtempSync(path.join(tmpdir(), "glyphs-"));
  temps.push(dir);
  const surahDir = path.join(dir, String(surah));
  mkdirSync(surahDir, { recursive: true });
  writeFileSync(path.join(surahDir, "corpus.json"), JSON.stringify(corpus));
  return ["--corpus-root", dir, "--surahs", String(surah)];
}

describe("check-corpus-glyphs.mjs — the WOFF2/cmap parser, against the REAL shipped fonts", () => {
  it("reproduces FONTS.md's manually-verified per-range coverage counts exactly", () => {
    // FONTS.md, "Codepoint coverage verified... 2026-08-11 (not from memory)":
    //   Arabic U+0600-06FF: 254 · Arabic Supplement U+0750-077F: 48 ·
    //   Presentation Forms-A U+FB50-FDFF: 611 · Presentation Forms-B
    //   U+FE70-FEFF: 140 · Quranic annotation marks U+06D6-06ED: 24/24.
    // This is the parser's own correctness proof: if WOFF2 table-directory or
    // cmap-format parsing is wrong, these counts will not match a number a
    // human independently verified from the font's own tables.
    const { out, code } = run([
      "--json",
      "--fonts", REAL_FONTS.join(","),
      ...fixtureCorpusArgs(1, { meta: { surah: 1 }, verses: [], words: [], distractors: [] }),
    ]);
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(true);
    // The two Amiri weights don't map an identical codepoint SET (amiri-700's
    // cmap is smaller — no separate format-12 subtable), so the union across
    // both files must be AT LEAST amiri-400's own count, proving both files
    // were actually read rather than only the first.
    expect(parsed.fontCodepointsMapped).toBeGreaterThanOrEqual(1690);
  });

  function countInRange(fonts: string[], lo: number, hi: number): number {
    // Drives the range count through the corpus path: a synthetic corpus made
    // of exactly the codepoints in [lo,hi] passes iff the parser's coverage
    // set contains all of them — the same code path a real gap would fail.
    const chars: string[] = [];
    for (let c = lo; c <= hi; c++) chars.push(String.fromCodePoint(c));
    const corpus = {
      meta: { surah: 2 },
      verses: [{ surah: 2, ayah: 1, text_uthmani: chars.join(""), page: null }],
      words: [],
      distractors: [],
    };
    const { out } = run(["--json", "--fonts", fonts.join(","), ...fixtureCorpusArgs(2, corpus)]);
    // --json always emits `uncovered` (empty array on a clean pass), so its
    // length is meaningful regardless of exit code.
    return JSON.parse(out).uncovered.length;
  }

  it("Arabic block U+0600-06FF: exactly 2 codepoints uncovered (256 in range - 254 mapped)", () => {
    expect(countInRange(REAL_FONTS, 0x0600, 0x06ff)).toBe(2);
  });
  it("Arabic Supplement U+0750-077F: exactly 0 uncovered out of 48 in a 48-wide range", () => {
    expect(countInRange(REAL_FONTS, 0x0750, 0x077f)).toBe(0);
  });
  it("Quranic annotation marks U+06D6-06ED: all 24/24 covered", () => {
    expect(countInRange(REAL_FONTS, 0x06d6, 0x06ed)).toBe(0);
  });
});

describe("check-corpus-glyphs.mjs — the gate itself", () => {
  it("FAILS on a codepoint the font does not map, naming the exact codepoint", () => {
    // U+2603 SNOWMAN — definitively outside every Arabic/Quranic range Amiri
    // ships, and definitively not present in any real corpus, so this proves
    // the gate actually discriminates rather than passing everything.
    const corpus = {
      meta: { surah: 900 },
      verses: [],
      words: [{ surah: 900, ayah: 1, position: 1, text_uthmani: String.fromCodePoint(0x2603) }],
      distractors: [],
    };
    const { out, code } = run(["--fonts", REAL_FONTS.join(","), ...fixtureCorpusArgs(900, corpus)]);
    expect(code).toBe(1);
    expect(out).toContain("U+2603");
    expect(out).toContain("words[].text_uthmani");
    expect(out).toContain("surah 900");
  });

  it("REPORTS EVERY uncovered codepoint, not just the first", () => {
    const corpus = {
      meta: { surah: 901 },
      verses: [
        { surah: 901, ayah: 1, text_uthmani: String.fromCodePoint(0x2603), page: null },
        { surah: 901, ayah: 2, text_uthmani: String.fromCodePoint(0x2604), page: null },
      ],
      words: [],
      distractors: [],
    };
    const { out, code } = run(["--json", "--fonts", REAL_FONTS.join(","), ...fixtureCorpusArgs(901, corpus)]);
    expect(code).toBe(1);
    const parsed = JSON.parse(out);
    const points = parsed.uncovered.map((u: { codePoint: string }) => u.codePoint);
    expect(points).toContain("U+2603");
    expect(points).toContain("U+2604");
  });

  it("PASSES on codepoints the font genuinely maps (plain ASCII, definitely covered)", () => {
    const corpus = {
      meta: { surah: 902 },
      verses: [{ surah: 902, ayah: 1, text_uthmani: "x", page: null }],
      words: [],
      distractors: [{ surah: 902, ayah: 1, position: 1, text: "y", rank: 1, prd_rank: "same-root", src_type: "visual", why: "", origin: "kernel" }],
    };
    const { out, code } = run(["--fonts", REAL_FONTS.join(","), ...fixtureCorpusArgs(902, corpus)]);
    expect(code).toBe(0);
    expect(out).toContain("OK");
  });

  it("checks distractors[].text — not only verses/words", () => {
    const corpus = {
      meta: { surah: 903 },
      verses: [],
      words: [],
      distractors: [{ surah: 903, ayah: 1, position: 1, text: String.fromCodePoint(0x2603), rank: 1, prd_rank: "same-root", src_type: "visual", why: "", origin: "kernel" }],
    };
    const { out, code } = run(["--fonts", REAL_FONTS.join(","), ...fixtureCorpusArgs(903, corpus)]);
    expect(code).toBe(1);
    expect(out).toContain("distractors[].text");
  });

  it("does not fail the whole run over a MISSING font — it fails LOUDLY instead", () => {
    const fixtureArgs = fixtureCorpusArgs(904, { meta: { surah: 904 }, verses: [], words: [], distractors: [] });
    const { out, code } = run(["--fonts", "/definitely/does/not/exist.woff2", ...fixtureArgs]);
    expect(code).toBe(1);
    expect(out.toLowerCase()).toContain("font");
  });

  it("SKIPS (exit 0) rather than fails when the corpus has not been compiled yet — v3-D52", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "glyphs-empty-"));
    temps.push(dir);
    const emptyRoot = path.join(dir, "nonexistent-output");
    const { out, code } = run(["--fonts", REAL_FONTS.join(","), "--corpus-root", emptyRoot]);
    expect(code).toBe(0);
    expect(out).toContain("SKIPPED");
  });

  it("does NOT vacuously pass when output/ exists but every surah is missing", () => {
    // The failure mode this build has shipped before: a 0-scanned run reading
    // as "OK". `output/` existing with nothing compiled under it is a genuine
    // anomaly (compile-corpus writes every launch surah together) and must
    // fail loudly, not report a silent green.
    const dir = mkdtempSync(path.join(tmpdir(), "glyphs-anomaly-"));
    temps.push(dir);
    const { out, code } = run(["--fonts", REAL_FONTS.join(","), "--corpus-root", dir, "--surahs", "905,906"]);
    expect(code).toBe(1);
    expect(out).not.toContain("OK —");
  });
});

describe("check-corpus-glyphs.mjs — against the REAL compiled launch corpus", () => {
  it("the current compiled corpus (12, 67, 103, 112) has zero uncovered codepoints", () => {
    if (!existsSync(REAL_OUTPUT_ROOT)) {
      throw new Error(
        `No compiled corpus at ${REAL_OUTPUT_ROOT}. Run \`make compile-corpus\` first ` +
          "— output/ is gitignored (v3-D52), so a clean checkout must build it.",
      );
    }
    for (const s of LAUNCH_SURAHS) {
      const f = path.join(REAL_OUTPUT_ROOT, String(s), "corpus.json");
      if (!existsSync(f)) throw new Error(`surah ${s} not compiled at ${f} — run \`make compile-corpus\`.`);
    }
    const { out, code } = run(["--json"]);
    if (code !== 0) {
      // Surface the actual finding in the failure message rather than a bare
      // assertion diff — this is the one test in the file that, if it goes
      // RED for real, names a genuine content defect against real Arabic
      // data, not a fixture.
      throw new Error(`corpus-glyphs found real gaps:\n${out}`);
    }
    const parsed = JSON.parse(out);
    expect(parsed.surahsChecked.sort()).toEqual([...LAUNCH_SURAHS].sort());
    expect(parsed.uncovered).toEqual([]);
    expect(parsed.distinctCodepointsChecked).toBeGreaterThan(0);
  });
});
