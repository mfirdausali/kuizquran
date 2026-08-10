// Invariant #6 / M0's "engine arch isolation" CI clause: the engine imports
// nothing from react/next/dom, and does no IO of its own (node:fs, node:http,
// etc.) — it is pure computation over data passed in. React renders what it's
// given and never decides; it can't decide if it can't even see a scheduling
// primitive to decide with.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(HERE, "..", "src");

const BANNED_IMPORT_RE = /^\s*import\s+(?:type\s+)?.*?\bfrom\s+["'](react|react-dom|next|node:.*)["']/m;

function engineSourceFiles(): string[] {
  return readdirSync(SRC_DIR).filter((f) => f.endsWith(".ts"));
}

describe("engine arch isolation (invariant #6)", () => {
  it("no engine source file imports react, react-dom, next, or a node: builtin", () => {
    const offenders = engineSourceFiles().filter((f) =>
      BANNED_IMPORT_RE.test(readFileSync(resolve(SRC_DIR, f), "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
