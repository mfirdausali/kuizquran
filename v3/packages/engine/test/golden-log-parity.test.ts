// Build-plan step 6: golden-log fold-parity. The oracle
// (v3/fixtures/golden-log/oracle.json) is v2's OWN rebuild() output over
// events.json, cut at the pinned SHA (v3/fixtures/golden-log/README.md).
// Step 5 ported rebuild.ts verbatim (bugs included); this test is the
// behavioral-drift gate every subsequent engine commit passes through —
// folding the SAME events through the PORTED rebuild() must reproduce the
// oracle byte-for-byte, because nothing engine-behavioral has changed yet.
//
// TZ=UTC pinned here (not left to the runner's environment) because
// daybound.ts:23's local-date-getter leak (INVARIANTS.md Absolute A, and
// this package's own purity.test.ts carve-out) makes the fold itself
// TZ-dependent until build-plan step 8's rewrite. Setting it at the top of
// this file, before any Date is constructed, matches
// gen-golden-log.ts's own enforcement — the oracle was generated under
// TZ=UTC, so parity can only be checked under TZ=UTC.
process.env.TZ = "UTC";

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rebuild } from "../src/rebuild.ts";
import { DEFAULT_DAY_CONFIG } from "../src/daybound.ts";
import type { DrillEvent } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(HERE, "..", "..", "..", "fixtures", "golden-log");

const events = JSON.parse(readFileSync(resolve(FIXTURE_DIR, "events.json"), "utf8")) as DrillEvent[];
const oracle = JSON.parse(readFileSync(resolve(FIXTURE_DIR, "oracle.json"), "utf8")) as Record<string, unknown>;

describe("golden-log fold-parity (build-plan step 6)", () => {
  it("process.env.TZ is UTC (the precondition this whole test depends on)", () => {
    expect(process.env.TZ).toBe("UTC");
  });

  it("rebuild(events) reproduces the oracle's exact atom key set", () => {
    const atoms = rebuild(events, DEFAULT_DAY_CONFIG);
    expect([...atoms.keys()].sort()).toEqual(Object.keys(oracle).sort());
  });

  it("rebuild(events) reproduces every atom byte-for-byte", () => {
    const atoms = rebuild(events, DEFAULT_DAY_CONFIG);
    const asObject: Record<string, unknown> = {};
    for (const key of [...atoms.keys()].sort()) asObject[key] = atoms.get(key);
    expect(asObject).toEqual(oracle);
  });
});
