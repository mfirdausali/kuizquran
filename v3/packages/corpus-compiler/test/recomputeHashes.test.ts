// Build-plan step 15's named live gap (DEFECTS.md#B3 / v3-D34): the compiler
// already had ayahQariHashWithOverrides/ayahAdminHashWithOverrides, but
// nothing composed them into a per-surah TABLE, and nothing exposed them to
// Laravel as a runnable process. "The override→re-ingest trigger is manual"
// is exactly the gap this file's two subjects close: buildAyahHashTableWithOverrides
// (the table, mirroring buildAyahHashTable's own shape) and recomputeHashes.ts
// (the CLI entry Laravel spawns the moment an override is written).
//
// All fixtures are real vendored corpus data (loadInputs/buildFromInputs —
// same as every other compiler test) or synthetic placeholder override
// payloads (English gloss/distractor text) — never authored Arabic
// (v3/INVARIANTS.md Absolute B).

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadInputs, buildFromInputs } from "../src/io.ts";
import { buildAyahHashTable, buildAyahHashTableWithOverrides, serializeCorpus } from "../src/manifest.ts";
import type { HashOverride } from "../src/hash.ts";

const glossOverride = (ayah: number, position: number, text: string, createdAt: number, id: number): HashOverride => ({
  ayah,
  position,
  field: "gloss",
  payload: { lang: "en", text },
  createdAt,
  id,
});

const distractorOverride = (ayah: number, position: number, text: string, createdAt: number, id: number): HashOverride => ({
  ayah,
  position,
  field: "distractor",
  payload: { distractors: [{ text, rank: 1, prd_rank: "synonym", src_type: "semantic", why: "override" }] },
  createdAt,
  id,
});

describe("buildAyahHashTableWithOverrides — the missing composition", () => {
  it("with zero overrides, is byte-identical to buildAyahHashTable (no silent baseline drift)", () => {
    const corpus = buildFromInputs(loadInputs(112));
    expect(buildAyahHashTableWithOverrides(corpus, [])).toEqual(buildAyahHashTable(corpus));
  });

  it("a gloss override moves only its own ayah's qariHash, never its adminHash, never a sibling ayah", () => {
    const corpus = buildFromInputs(loadInputs(112));
    const baseline = buildAyahHashTable(corpus);
    const overridden = buildAyahHashTableWithOverrides(corpus, [glossOverride(1, 1, "corrected-gloss", 100, 1)]);

    expect(overridden.find((r) => r.ayah === 1)!.qariHash).not.toBe(baseline.find((r) => r.ayah === 1)!.qariHash);
    expect(overridden.find((r) => r.ayah === 1)!.adminHash).toBe(baseline.find((r) => r.ayah === 1)!.adminHash);
    for (const row of overridden.filter((r) => r.ayah !== 1)) {
      const base = baseline.find((r) => r.ayah === row.ayah)!;
      expect(row.qariHash).toBe(base.qariHash);
      expect(row.adminHash).toBe(base.adminHash);
    }
  });

  it("a distractor override moves only its own ayah's adminHash, never its qariHash", () => {
    const corpus = buildFromInputs(loadInputs(112));
    const baseline = buildAyahHashTable(corpus);
    const overridden = buildAyahHashTableWithOverrides(corpus, [distractorOverride(1, 1, "foil", 100, 1)]);

    expect(overridden.find((r) => r.ayah === 1)!.adminHash).not.toBe(baseline.find((r) => r.ayah === 1)!.adminHash);
    expect(overridden.find((r) => r.ayah === 1)!.qariHash).toBe(baseline.find((r) => r.ayah === 1)!.qariHash);
  });

  it("has exactly ayahCount rows, in verse order, same shape as the baseline table", () => {
    const corpus = buildFromInputs(loadInputs(103));
    const table = buildAyahHashTableWithOverrides(corpus, []);
    expect(table.map((r) => r.ayah)).toEqual(corpus.verses.map((v) => v.ayah));
    for (const row of table) expect(row.hashSpecVersion).toBe(corpus.meta.hashSpecVersion);
  });
});

describe("recomputeHashes.ts — the process Laravel spawns the moment an override is written", () => {
  const PKG = join(import.meta.dirname, "..");
  const SCRIPT = join(PKG, "src", "recomputeHashes.ts");

  function writeCorpusFixture(surah: number): string {
    const corpus = buildFromInputs(loadInputs(surah));
    const dir = mkdtempSync(join(tmpdir(), "recompute-hashes-test-"));
    const path = join(dir, "corpus.json");
    writeFileSync(path, serializeCorpus(corpus));
    return path;
  }

  function run(args: string[], stdin: string) {
    const r = spawnSync(process.execPath, ["--experimental-strip-types", SCRIPT, ...args], {
      input: stdin,
      encoding: "utf8",
      timeout: 30_000,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(r.stdout.trim());
    } catch {
      parsed = undefined;
    }
    return { exit: r.status, parsed, stderr: r.stderr };
  }

  it("exits 0 and prints the override-aware table, matching the pure function exactly", () => {
    const corpus = buildFromInputs(loadInputs(112));
    const path = writeCorpusFixture(112);
    const overrides = [glossOverride(1, 1, "corrected-gloss", 100, 1)];

    const { exit, parsed } = run([path], JSON.stringify(overrides));

    expect(exit).toBe(0);
    expect(parsed).toEqual(buildAyahHashTableWithOverrides(corpus, overrides));
  });

  it("with empty stdin (no piped overrides), behaves as zero overrides — the baseline table", () => {
    const corpus = buildFromInputs(loadInputs(112));
    const path = writeCorpusFixture(112);

    const { exit, parsed } = run([path], "");

    expect(exit).toBe(0);
    expect(parsed).toEqual(buildAyahHashTable(corpus));
  });

  it("exits 1 with a JSON error, never a stack trace, on a missing corpus file", () => {
    const { exit, parsed } = run(["/nonexistent/corpus.json"], "[]");
    expect(exit).toBe(1);
    expect(parsed).toHaveProperty("error");
  });

  it("exits 1 with a JSON error on malformed overrides JSON, rather than silently ignoring it", () => {
    const path = writeCorpusFixture(112);
    const { exit, parsed } = run([path], "{not json");
    expect(exit).toBe(1);
    expect(parsed).toHaveProperty("error");
  });

  it("exits 1 with a JSON error when stdin is valid JSON but not an array", () => {
    const path = writeCorpusFixture(112);
    const { exit, parsed } = run([path], "{}");
    expect(exit).toBe(1);
    expect(parsed).toHaveProperty("error");
  });

  it("exits 1 with a JSON error when no corpus path argument is given", () => {
    const { exit, parsed } = run([], "[]");
    expect(exit).toBe(1);
    expect(parsed).toHaveProperty("error");
  });
});
