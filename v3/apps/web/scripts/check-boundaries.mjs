#!/usr/bin/env node
// GATE: the import/render boundaries (plan §D3, §E4).
//
//     Corpus is server. Log is client. Skeletons are never zeros.
//
// The reason "no IDB in an RSC" is not stylistic: a server render has no log,
// so it renders zero; the client hydrates with the real value; React sees 0 vs
// 4 and in PRODUCTION silently paints the wrong number — "0 ayat due" to a
// learner who has four. That is a retention-honesty violation, not a warning.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(dir, "..");
const SKIP = new Set(["node_modules", ".next", ".git", "public", "scripts"]);

function walk(start) {
  const out = [];
  const stack = [start];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur);
    } catch {
      continue;
    }
    for (const e of entries) {
      if (SKIP.has(e)) continue;
      const p = path.join(cur, e);
      if (statSync(p).isDirectory()) stack.push(p);
      else if (/\.(ts|tsx|mjs)$/.test(e)) out.push(p);
    }
  }
  return out;
}

const files = walk(ROOT);
const rel = (p) => path.relative(ROOT, p);
const read = (p) => readFileSync(p, "utf8");
const isClient = (src) => /^\s*(["'])use client\1/m.test(src.split("\n").slice(0, 5).join("\n"));
/** Strip comments so a clause inspects CODE, not prose ABOUT the code. These
 *  modules document the very rules being enforced, and a gate that fires on
 *  its own documentation trains people to ignore it. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const violations = [];

// --- Clause 1: every lib/idb module declares "use client". ---
for (const f of files.filter((f) => rel(f).startsWith("lib/idb/"))) {
  if (rel(f).endsWith(".test.ts")) continue;
  if (!isClient(read(f))) {
    violations.push(`${rel(f)}: a lib/idb module without "use client" (plan §D3).`);
  }
}

// --- Clause 2: no app/** file imports lib/idb without "use client". ---
for (const f of files.filter((f) => rel(f).startsWith("app/"))) {
  const src = read(f);
  if (/from\s+["'][^"']*lib\/idb/.test(src) && !isClient(src)) {
    violations.push(
      `${rel(f)}: imports lib/idb but is a SERVER component. SSR of a ` +
        `log-derived value paints a wrong number (edge case #72).`,
    );
  }
}

// --- Clause 3: indexedDB.open appears ONLY in lib/idb/db.ts. ---
for (const f of files) {
  const r = rel(f);
  if (r === "lib/idb/db.ts" || r.endsWith(".test.ts")) continue;
  if (/indexedDB\.open\s*\(/.test(stripComments(read(f)))) {
    violations.push(`${r}: calls indexedDB.open directly. All access goes through lib/idb/db.ts.`);
  }
}

// --- Clause 4: sacred text. NO Arabic codepoint may be a literal, anywhere. ---
// Every Arabic glyph the UI paints arrives at RUNTIME from corpus data. Also
// catches the escape hatches: \u06xx and String.fromCharCode.
// Ranges written as \u escapes, NOT literal boundary characters. Spelling them
// literally would put real Arabic codepoints in this file, so a repo-wide
// sacred-text scan would flag its own detector — the one false positive
// guaranteed to teach people to ignore the scan. Same ranges, zero literals.
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
for (const f of files) {
  const src = read(f);
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    if (ARABIC.test(line)) {
      violations.push(`${rel(f)}:${i + 1}: literal Arabic codepoint. Arabic comes from the corpus at runtime.`);
    }
    if (/\\u0[6-7][0-9A-Fa-f]{2}/.test(line)) {
      violations.push(`${rel(f)}:${i + 1}: \\u escape in the Arabic range — the same violation, escaped.`);
    }
  });
  if (/String\.fromCharCode/.test(src)) {
    violations.push(`${rel(f)}: String.fromCharCode — never synthesise Arabic codepoints.`);
  }
}

// --- Clause 5: no engine-DECISION logic in JSX (edge case #190 / B2). ---
// Rungs and schedules are decided in the engine and arrive as DATA. This is
// what makes B2 impossible by construction rather than merely fixed once.
const DECISION = /\b(blankCountFor|assembleQueue|unlockPermitted)\b|strength\s*[<>]|\bband\s*===/;
for (const f of files.filter((f) => /^(app|components)\//.test(rel(f)))) {
  const src = stripComments(read(f));
  src.split("\n").forEach((line, i) => {
    if (DECISION.test(line)) {
      violations.push(`${rel(f)}:${i + 1}: engine-decision logic in a view. It must arrive as data.`);
    }
  });
}

// --- Clause 6: SINGLE EGRESS. Only lib/sync/apiFetch.ts calls fetch() at /api. ---
// DEFECTS.md#B8's frontend half is an interceptor that clears a dead token and
// re-mints. An interceptor is only a guarantee if it cannot be bypassed, and a
// second, un-wrapped `fetch("/api/...")` is EXACTLY how B8 comes back: that
// call would carry a dead token, 401 forever, and never clear anything.
//
// Mirrors clause 3 (indexedDB.open appears only in lib/idb/db.ts), which is the
// proven pattern here. apiFetch.ts is the one exemption, and it earns it: its
// mint call MUST bypass the interceptor, because a 401 from the mint endpoint
// triggering a mint is the re-mint loop, directly.
const EGRESS_EXEMPT = new Set(["lib/sync/apiFetch.ts"]);
for (const f of files) {
  const r = rel(f);
  if (EGRESS_EXEMPT.has(r) || r.endsWith(".test.ts") || r.endsWith(".test.tsx")) continue;
  const src = stripComments(read(f));
  src.split("\n").forEach((line, i) => {
    // A fetch whose target mentions /api — literal, template, or via a base
    // constant that ends in the path.
    if (/\bfetch\s*\(\s*[`"'][^`"']*\/api\//.test(line)) {
      violations.push(
        `${r}:${i + 1}: raw fetch() to /api. All API egress goes through ` +
          `lib/sync/apiFetch.ts, or the 401 interceptor (DEFECTS.md#B8) is bypassable.`,
      );
    }
  });
}

// --- Clause 7: NO OMIT-DESTRUCTURING IN THE SYNC MERGE. ---
// DEFECTS.md#B5 is one line: `const { seq: _drop, ...rest } = e`. The merge
// dropped a field and log order became arrival order. The v3 rule is not "omit
// the right fields" — it is that the merge has NO OMIT LIST AT ALL, so this
// clause makes the GESTURE unwritable rather than merely tested-against.
//
// Scoped to lib/sync/ because that is where a merge lives. schema.ts's `toWire`
// legitimately uses this shape to strip the local-only `syncedAt`, and it is
// the SINGLE place allowed to know which fields are local — every other module
// calls it rather than re-implementing the strip.
const OMIT_DESTRUCTURE = /const\s*\{\s*[A-Za-z_$][\w$]*\s*:\s*_[\w$]*\s*,\s*\.\.\./;
for (const f of files.filter((f) => rel(f).startsWith("lib/sync/"))) {
  const r = rel(f);
  if (r.endsWith(".test.ts")) continue;
  const src = stripComments(read(f));
  src.split("\n").forEach((line, i) => {
    if (OMIT_DESTRUCTURE.test(line)) {
      violations.push(
        `${r}:${i + 1}: omit-destructuring in the sync island — this is ` +
          `DEFECTS.md#B5's literal syntax. The merge preserves every wire ` +
          `field; use lib/idb/schema.ts#toWire to strip local-only fields.`,
      );
    }
  });
}

if (violations.length > 0) {
  console.error(`\n✗ boundaries gate FAILED — ${violations.length} violation(s)\n`);
  for (const v of violations) console.error(`   ✗  ${v}`);
  console.error("");
  process.exit(1);
}

console.log(`boundaries: OK — ${files.length} files checked (idb/client, sacred-text, engine-decision).`);
