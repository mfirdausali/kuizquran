// CLAUSE 4 OF THE BOUNDARIES GATE — the sacred-text escape-hatch check
// (scripts/check-boundaries.mjs, INVARIANTS.md Absolute B).
//
// ---------------------------------------------------------------------------
// WHY THE TESTS SPAWN THE REAL SCRIPT
// ---------------------------------------------------------------------------
// `content-freeze-gate.test.ts` already states this build's rule: "A gate is
// only worth its exit code. Testing an extracted helper would prove the
// helper works while the SCRIPT... could stop calling it." Every test below
// runs `check-boundaries.mjs` the way `npm run gates`/`prebuild` runs it,
// against a synthetic fixture tree in a temp directory, and asserts on
// stdout/exit code only, never on an imported function. The script gained a
// `--root <path>` override for exactly this — mirroring
// `check-corpus-glyphs.mjs`'s own `--corpus-root` — so a test never has to
// write fixture files into the real tracked apps/web tree.
//
// WHAT THIS FILE FOUND. Clause 4's own escape-hatch check covered only the
// main-Arabic and Arabic-Supplement escape ranges (hex 0600-07FF), leaving
// three of the five ranges its own sibling literal-character check (and
// INVARIANTS.md's own Absolute B) names completely unguarded AS AN ESCAPE:
// Arabic Extended-A (hex 08A0-08FF) and Presentation Forms-A/B (hex
// FB50-FDFF, FE70-FEFF). A codepoint from any of those three ranges, written
// into source as a backslash-u escape rather than typed as a literal glyph,
// passed the gate silently; so did `String.fromCodePoint(0x0645)`, a second
// numeric escape hatch with no check at all, sitting right beside its
// already-banned sibling (this comment deliberately never spells that
// sibling's dotted name out, since clause 4's own blanket check for it
// scans raw, uncommented source and would otherwise flag this very
// sentence). Confirmed live, before any fix, against the REAL script: a
// throwaway file under `lib/` containing exactly those three constructs
// made `check-boundaries.mjs` print `boundaries: OK`.
//
// NOT ONE REAL ARABIC BYTE IS WRITTEN HERE. Every fixture below assembles its
// escape or fromCodePoint call from plain ASCII source text and hex-integer
// arithmetic — the exact shape a model would have to write to exploit the
// gap — never an actual Unicode character in this test file itself.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(WEB_ROOT, "scripts/check-boundaries.mjs");

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

function run(root: string): { out: string; code: number } {
  const r = spawnSync("node", [SCRIPT, "--root", root], { encoding: "utf8" });
  return { out: (r.stdout ?? "") + (r.stderr ?? ""), code: r.status ?? 1 };
}

/** Writes a fresh temp root with the given { relativePath: content } map and
 *  returns the root. Deliberately does NOT replicate the real tree's fixed
 *  allowlists/markup files (ENTITLEMENT_ALLOWLIST, LANDING_MARKUP, etc.) —
 *  those clauses' own "does this named file exist" rot-checks will fire
 *  against an empty fixture root regardless of this file's content, so every
 *  assertion below targets the SPECIFIC clause-4 message rather than
 *  requiring the whole gate to pass cleanly. */
function fixtureRoot(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "boundaries-"));
  temps.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
  }
  return dir;
}

/** Builds literal source text containing a ONE-backslash \u escape for the
 *  given codepoint — i.e. exactly what a hand-typed escape looks like in a
 *  .ts file — via string concatenation, never a real escape sequence in
 *  THIS file's own source. */
function uEscapeLiteral(codepoint: number): string {
  const hex = codepoint.toString(16).toUpperCase().padStart(4, "0");
  return "\\u" + hex;
}

describe("check-boundaries.mjs clause 4 — the sacred-text escape-hatch check", () => {
  it("still catches a plain \\u06xx escape (main Arabic) — the pre-fix behavior, unregressed", () => {
    const root = fixtureRoot({
      "lib/probe.ts": `export const x = "${uEscapeLiteral(0x0645)}";\n`,
    });
    const { out, code } = run(root);
    expect(code).toBe(1);
    expect(out).toContain("lib/probe.ts:1");
    expect(out).toContain("escape in the Arabic range");
  });

  it("catches a \\u08xx escape (Arabic Extended-A) — invisible to the pre-fix regex, which stopped at \\u07xx", () => {
    const root = fixtureRoot({
      "lib/probe.ts": `export const x = "${uEscapeLiteral(0x08a1)}";\n`,
    });
    const { out, code } = run(root);
    expect(code).toBe(1);
    expect(out).toContain("lib/probe.ts:1");
    expect(out).toContain("escape in the Arabic range");
  });

  it("catches a \\uFBxx escape (Presentation Forms-A) — invisible to the pre-fix regex", () => {
    const root = fixtureRoot({
      "lib/probe.ts": `export const x = "${uEscapeLiteral(0xfb50)}";\n`,
    });
    const { out, code } = run(root);
    expect(code).toBe(1);
    expect(out).toContain("escape in the Arabic range");
  });

  it("catches a \\uFExx escape (Presentation Forms-B) — invisible to the pre-fix regex", () => {
    const root = fixtureRoot({
      "lib/probe.ts": `export const x = "${uEscapeLiteral(0xfe70)}";\n`,
    });
    const { out, code } = run(root);
    expect(code).toBe(1);
    expect(out).toContain("escape in the Arabic range");
  });

  it("does NOT flag an ordinary \\uXXXX escape outside every Arabic-adjacent range (e.g. a Latin or symbol codepoint)", () => {
    // A negative control proving the widened regex is still bounded, not a
    // blanket "any \\u escape" ban — é is "é", nowhere near Arabic.
    const root = fixtureRoot({
      "lib/probe.ts": `export const x = "${uEscapeLiteral(0x00e9)}";\n`,
    });
    const { out } = run(root);
    expect(out).not.toContain("escape in the Arabic range");
  });

  it("catches String.fromCodePoint synthesizing an Arabic codepoint in PRODUCTION code — the second escape hatch, previously unchecked entirely", () => {
    const root = fixtureRoot({
      "lib/probe.ts": "export const x = String.fromCodePoint(0x0645);\n",
    });
    const { out, code } = run(root);
    expect(code).toBe(1);
    expect(out).toContain("lib/probe.ts");
    expect(out).toContain("String.fromCodePoint");
  });

  it("does NOT flag String.fromCodePoint inside a *.test.ts file — the established, documented convention (check-corpus-glyphs-gate.test.ts, content-freeze-gate.test.ts) for synthesizing SYNTHETIC, non-Quranic Arabic-range bytes to test infrastructure like the glyph-coverage parser", () => {
    const root = fixtureRoot({
      "lib/probe.test.ts": "export const x = String.fromCodePoint(0x0645);\n",
    });
    const { out } = run(root);
    expect(out).not.toContain("String.fromCodePoint");
  });

  it("does NOT flag String.fromCodePoint outside app/components/lib (e.g. a repo-root script) — scoped to production surfaces only, matching clauses 5/13/14/15's own precedent", () => {
    const root = fixtureRoot({
      "scripts-outside-scope/probe.ts": "export const x = String.fromCodePoint(0x0645);\n",
    });
    const { out } = run(root);
    expect(out).not.toContain("String.fromCodePoint");
  });
});
