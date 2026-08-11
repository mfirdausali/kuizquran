// THE CONTENT-FREEZE GATE AND THE DISTRACTOR QA SAMPLER (build-plan 27/28, M9).
//
// These two scripts are the engineering half of M9. They are the reason
// "booking a qari against an unfrozen corpus" becomes a visible mistake rather
// than a calendar event nobody notices until every signature ambers at once.
//
// ---------------------------------------------------------------------------
// WHY THE TESTS DRIVE THE REAL SCRIPTS OVER FIXTURE TREES
// ---------------------------------------------------------------------------
// A gate is only worth its exit code. Testing an extracted helper would prove
// the helper works while the SCRIPT — the thing anyone actually runs, and the
// thing whose exit code CI would consult — could stop calling it. That is this
// build's own most recent vacuous verification (a regression test asserted a
// helper directly and survived a mutation that stopped the product calling it).
//
// So every test here spawns the script the way a human runs it, against a
// synthetic corpus tree in a temp directory, and asserts on stdout and the exit
// code. `--surahs` exists precisely so the launch set can be pointed at a
// fixture without the script growing a test-only code path.

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const V3 = path.resolve(__dirname, "../../..");
const FREEZE = path.join(V3, "scripts/content-freeze.mjs");
const QA = path.join(V3, "scripts/distractor-qa.mjs");

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

/** Run a script and capture stdout + exit code. A non-zero exit is the GATE
 *  FIRING, not a test error, so it is captured rather than thrown. */
function run(script: string, args: string[], cwd?: string): { out: string; code: number } {
  try {
    const out = execFileSync("node", [script, ...args], {
      encoding: "utf8",
      cwd: cwd ?? V3,
    });
    return { out, code: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { out: (e.stdout ?? "") + (e.stderr ?? ""), code: e.status ?? 1 };
  }
}

describe("content-freeze.mjs — the gate", () => {
  it("EXITS NON-ZERO against the repository's real corpus today", () => {
    // The load-bearing behaviour. Today the QA samples are unsigned and
    // BUILD-PLAN's Q3 (the launch surah set) is open, so the honest verdict is
    // CLOSED. A gate that passed here would be licensing a scholar booking.
    const { out, code } = run(FREEZE, []);
    expect(code).toBe(1);
    expect(out).toContain("GATE CLOSED");
    expect(out).toContain("do NOT book");
  });

  it("prints M9's HARD ORDER as a sequence, every run", () => {
    // M9 is a SEQUENCE — shipping out of order re-buys scholar hours. The
    // order belongs on the screen beside the verdict, not in a document
    // someone must remember to open.
    const { out } = run(FREEZE, []);
    expect(out).toContain("HARD ORDER");
    const msIdx = out.indexOf("MS decision executed");
    const beatsIdx = out.indexOf("scene beats authored");
    const qaIdx = out.indexOf("distractor QA");
    const freezeIdx = out.indexOf("corpus + spec freeze");
    const qariIdx = out.indexOf("qari sessions");
    // Every step appears, and in the order M9 mandates.
    for (const i of [msIdx, beatsIdx, qaIdx, freezeIdx, qariIdx]) expect(i).toBeGreaterThan(-1);
    expect(msIdx).toBeLessThan(beatsIdx);
    expect(beatsIdx).toBeLessThan(qaIdx);
    expect(qaIdx).toBeLessThan(freezeIdx);
    expect(freezeIdx).toBeLessThan(qariIdx);
  });

  it("reports every criterion with EVIDENCE, not a bare verdict", () => {
    const { out } = run(FREEZE, ["--surahs", "12"]);
    // A checklist is what already failed this build. Each criterion carries
    // the fact that decided it.
    expect(out).toMatch(/MS decision executed/);
    expect(out).toMatch(/hashSpecVersion/);
    expect(out).toMatch(/ayahQariHash reads gloss\.en only/);
  });

  it("emits machine-readable JSON with a `bookable` verdict", () => {
    const { out } = run(FREEZE, ["--json"]);
    const parsed = JSON.parse(out);
    expect(parsed.bookable).toBe(false);
    expect(Array.isArray(parsed.criteria)).toBe(true);
    // Every criterion names itself and carries evidence.
    for (const c of parsed.criteria) {
      expect(typeof c.name).toBe("string");
      expect(Array.isArray(c.evidence)).toBe(true);
      expect(c.evidence.length).toBeGreaterThan(0);
    }
  });

  it("treats a TODO scene-beat placeholder as NOT MET", () => {
    // The failure a naive count misses: a beat row EXISTS, so "scene beats
    // authored" looks satisfied — but its label is still the compiler's
    // "TODO: author scene-beat label for act N", and that string HASHES into
    // the qari tier. A qari would sign a TODO, and replacing it later ambers
    // the ayah. A placeholder is worse than an absence.
    const dir = mkdtempSync(path.join(tmpdir(), "freeze-todo-"));
    temps.push(dir);
    const out = path.join(dir, "packages/corpus-compiler/output/900");
    mkdirSync(out, { recursive: true });
    // A NON-atomic surah (>8 ayat) so beats are genuinely owed.
    const corpus = {
      meta: { surah: 900, ayahCount: 20, hashSpecVersion: 1 },
      words: [],
      distractors: [{ ayah: 1, position: 1, rank: 1, text: "x", origin: "kernel", src_type: "visual" }],
      sceneBeats: [
        { surah: 900, act: 1, label: "An authored label.", ayahs: [1] },
        { surah: 900, act: 2, label: "TODO: author scene-beat label for act 2 (Something)", ayahs: [2] },
      ],
    };
    writeFileSync(path.join(out, "corpus.json"), JSON.stringify(corpus));
    writeFileSync(
      path.join(dir, "packages/corpus-compiler/output/manifest.json"),
      JSON.stringify({ surahs: { "900": { corpusHash: "deadbeef", ayahCount: 20 } } }),
    );
    // The script resolves paths from its own location, so the fixture tree
    // needs the files it reads: DECISIONS.md, BUILD-PLAN.md and hash.ts.
    seedRepoFiles(dir);

    const { out: stdout } = run(path.join(dir, "scripts/content-freeze.mjs"), ["--surahs", "900"], dir);
    expect(stdout).toContain("TODO placeholder");
    expect(stdout).toContain("NOT MET  Scene beats");
  });

  it("does NOT demand scene beats for an ATOMIC surah (v3-D21)", () => {
    // v3-D21: ATOMIC (<=8 ayat) renders NO macro panel, so no beats are owed.
    // A gate demanding them would manufacture authoring work the design
    // explicitly removed — and an honest gate must not invent human hours.
    const dir = mkdtempSync(path.join(tmpdir(), "freeze-atomic-"));
    temps.push(dir);
    const out = path.join(dir, "packages/corpus-compiler/output/901");
    mkdirSync(out, { recursive: true });
    writeFileSync(
      path.join(out, "corpus.json"),
      JSON.stringify({
        meta: { surah: 901, ayahCount: 4, hashSpecVersion: 1 },
        words: [],
        distractors: [{ ayah: 1, position: 1, rank: 1, text: "x", origin: "kernel", src_type: "visual" }],
        sceneBeats: [],
      }),
    );
    writeFileSync(
      path.join(dir, "packages/corpus-compiler/output/manifest.json"),
      JSON.stringify({ surahs: { "901": { corpusHash: "cafe", ayahCount: 4 } } }),
    );
    seedRepoFiles(dir);

    const { out: stdout } = run(path.join(dir, "scripts/content-freeze.mjs"), ["--surahs", "901"], dir);
    expect(stdout).toContain("MET      Scene beats");
    expect(stdout).toContain("ATOMIC");
  });

  it("flags an ms gloss that leaked into a compiled corpus", () => {
    // Edge case #189: "agent machine-fills MS glosses to be helpful". The
    // decision is EXECUTED only if no compiled artifact carries one.
    const dir = mkdtempSync(path.join(tmpdir(), "freeze-msleak-"));
    temps.push(dir);
    const out = path.join(dir, "packages/corpus-compiler/output/902");
    mkdirSync(out, { recursive: true });
    writeFileSync(
      path.join(out, "corpus.json"),
      JSON.stringify({
        meta: { surah: 902, ayahCount: 4, hashSpecVersion: 1 },
        words: [{ ayah: 1, position: 1, gloss: { en: "say", ms: "katakanlah", ja: null } }],
        distractors: [{ ayah: 1, position: 1, rank: 1, text: "x", origin: "kernel", src_type: "visual" }],
        sceneBeats: [],
      }),
    );
    writeFileSync(
      path.join(dir, "packages/corpus-compiler/output/manifest.json"),
      JSON.stringify({ surahs: { "902": { corpusHash: "beef", ayahCount: 4 } } }),
    );
    seedRepoFiles(dir);

    const { out: stdout } = run(path.join(dir, "scripts/content-freeze.mjs"), ["--surahs", "902"], dir);
    expect(stdout).toContain("NOT MET  MS decision executed");
    expect(stdout).toContain("carry a non-null gloss.ms");
  });
});

describe("distractor-qa.mjs — the 10% sample", () => {
  it("is DETERMINISTIC — the same corpus yields the same sample", () => {
    // A reviewer who is interrupted must be able to resume, and two people
    // must be able to review "the sample". Math.random would break both (and
    // is forbidden by the purity lints regardless).
    const a = run(QA, ["--surah", "112", "--json"]).out;
    const b = run(QA, ["--surah", "112", "--json"]).out;
    expect(a).toBe(b);
  });

  it("samples the requested percentage of OPTION SETS, not rows", () => {
    // The unit of review is the option set: "is this a fair foil" is only
    // answerable beside the correct answer and its siblings.
    const parsed = JSON.parse(run(QA, ["--surah", "12", "--pct", "10", "--json"]).out);
    expect(parsed.sampled).toBe(Math.ceil(parsed.totalCoordinates * 0.1));
    for (const item of parsed.items) {
      expect(Array.isArray(item.foils)).toBe(true);
      expect(item.foils.length).toBeGreaterThan(0);
    }
  });

  it("leaves every verdict EMPTY for a human", () => {
    // An agent filling these in is an agent certifying religious content.
    const parsed = JSON.parse(run(QA, ["--surah", "112", "--json"]).out);
    expect(parsed.signedBy).toBeNull();
    for (const item of parsed.items) {
      expect(item.verdict).toBeNull();
      expect(item.reviewerNote).toBeNull();
    }
  });

  it("records the corpus hash the sample was drawn from", () => {
    // So content-freeze.mjs can tell a current sample from a stale one — the
    // same staleness logic the frontier applies to a qari's signature.
    const parsed = JSON.parse(run(QA, ["--surah", "112", "--json"]).out);
    expect(typeof parsed.corpusHash).toBe("string");
    expect(parsed.corpusHash.length).toBeGreaterThan(0);
  });

  it("detects a foil that is GRADE-EQUAL to the correct answer", () => {
    // The live-defect class: byte-different, grade-identical (a stray tatweel),
    // so the option set has TWO CORRECT ANSWERS and the engine grades both
    // right. Recomputed here from corpus bytes rather than trusting the
    // compiler to have caught it — a QA sample that trusted the compiler would
    // never catch the compiler being wrong.
    const dir = mkdtempSync(path.join(tmpdir(), "qa-collide-"));
    temps.push(dir);
    const out = path.join(dir, "packages/corpus-compiler/output/903");
    mkdirSync(out, { recursive: true });
    // A tatweel appended to the target's surface. No Arabic literal appears in
    // this test — the "surface" is a plain ASCII placeholder plus U+0640, and
    // what is being asserted is the EQUIVALENCE RULE, not any Quranic byte.
    const TATWEEL = String.fromCodePoint(0x0640);
    writeFileSync(
      path.join(out, "corpus.json"),
      JSON.stringify({
        meta: { surah: 903, ayahCount: 1, hashSpecVersion: 1 },
        words: [{ ayah: 1, position: 1, text_uthmani: "target", gloss: { en: "x", ms: null, ja: null } }],
        distractors: [
          { ayah: 1, position: 1, rank: 1, text: "target" + TATWEEL, origin: "kernel", src_type: "visual", prd_rank: "look-alike-verse", why: "" },
          { ayah: 1, position: 1, rank: 2, text: "other", origin: "kernel", src_type: "phonetic", prd_rank: "synonym", why: "" },
          { ayah: 1, position: 1, rank: 3, text: "another", origin: "kernel", src_type: "semantic", prd_rank: "same-root", why: "" },
        ],
        sceneBeats: [],
      }),
    );
    writeFileSync(
      path.join(dir, "packages/corpus-compiler/output/manifest.json"),
      JSON.stringify({ surahs: { "903": { corpusHash: "feed", ayahCount: 1 } } }),
    );
    seedRepoFiles(dir);

    const { out: stdout } = run(
      path.join(dir, "scripts/distractor-qa.mjs"),
      ["--surah", "903", "--pct", "100"],
      dir,
    );
    expect(stdout).toContain("GRADE-EQUAL");
    expect(stdout).toContain("two correct answers");
  });

  it("flags a near-degenerate option set (D51's own defect)", () => {
    // Surah 112 once compiled with ZERO distractors, so every tile bank held
    // only the correct answer. Fewer than 3 foils means picking by elimination.
    const dir = mkdtempSync(path.join(tmpdir(), "qa-degenerate-"));
    temps.push(dir);
    const out = path.join(dir, "packages/corpus-compiler/output/904");
    mkdirSync(out, { recursive: true });
    writeFileSync(
      path.join(out, "corpus.json"),
      JSON.stringify({
        meta: { surah: 904, ayahCount: 1, hashSpecVersion: 1 },
        words: [{ ayah: 1, position: 1, text_uthmani: "target", gloss: { en: "x", ms: null, ja: null } }],
        distractors: [
          { ayah: 1, position: 1, rank: 1, text: "only-one", origin: "kernel", src_type: "visual", prd_rank: "look-alike-verse", why: "" },
        ],
        sceneBeats: [],
      }),
    );
    writeFileSync(
      path.join(dir, "packages/corpus-compiler/output/manifest.json"),
      JSON.stringify({ surahs: { "904": { corpusHash: "f00d", ayahCount: 1 } } }),
    );
    seedRepoFiles(dir);

    const { out: stdout } = run(
      path.join(dir, "scripts/distractor-qa.mjs"),
      ["--surah", "904", "--pct", "100"],
      dir,
    );
    expect(stdout).toContain("near-degenerate");
  });
});

/** Copy the repo files both scripts read (they resolve from their own path). */
function seedRepoFiles(dir: string) {
  mkdirSync(path.join(dir, "scripts"), { recursive: true });
  cpSync(FREEZE, path.join(dir, "scripts/content-freeze.mjs"));
  cpSync(QA, path.join(dir, "scripts/distractor-qa.mjs"));
  mkdirSync(path.join(dir, "packages/corpus-compiler/src"), { recursive: true });
  cpSync(
    path.join(V3, "packages/corpus-compiler/src/hash.ts"),
    path.join(dir, "packages/corpus-compiler/src/hash.ts"),
  );
  mkdirSync(path.join(dir, "docs"), { recursive: true });
  cpSync(path.join(V3, "docs/BUILD-PLAN.md"), path.join(dir, "docs/BUILD-PLAN.md"));
  cpSync(path.join(V3, "DECISIONS.md"), path.join(dir, "DECISIONS.md"));
}
