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

// --- Clause 8: RECALL BEFORE IDENTITY (WIREFRAME §17's governing rule). ---
// "No account, no email, no notification prompt until the learner has produced
// an ayah from memory."
//
// This clause exists because an adversarial review proved the rule was
// DECORATIVE: it lived only in WIREFRAME.md prose, and a mutation putting an
// email capture as the FIRST element of the landing page passed every gate and
// all 319 tests. A governing rule that no check enforces is a rule that erodes
// the first time someone adds "just a quick email field" — and the erosion is
// invisible, because nothing goes red.
//
// The rule is about ORDER, which a static grep cannot fully judge. So this
// clause enforces the part that IS statically decidable and is the actual
// failure mode: identity-capture UI must not appear in the pre-recall surfaces
// (the landing page and any onboarding step before the recall screen). A file
// that legitimately captures identity — the real register/sign-in surface, or
// an onboarding step AFTER the recall — opts out with an explicit marker
// naming why, which makes every exception a visible, reviewable decision
// rather than a silent drift.
const IDENTITY_CAPTURE =
  /type=["']email["']|name=["']email["']|autoComplete=["'](?:email|username|new-password|current-password)["']|Notification\.requestPermission|type=["']password["']/;
const PRE_RECALL_OPT_OUT = "@allow-identity-capture";
// Pre-recall surfaces: the landing page, and onboarding steps. Extend this list
// as onboarding lands — a new pre-recall route MUST be added here.
const PRE_RECALL = [/^app\/page\.tsx$/, /^app\/\(onboarding\)\//, /^components\/onboarding\//];
for (const f of files) {
  const r = rel(f);
  if (r.endsWith(".test.ts") || r.endsWith(".test.tsx")) continue;
  if (!PRE_RECALL.some((re) => re.test(r))) continue;
  const raw = read(f);
  if (raw.includes(PRE_RECALL_OPT_OUT)) continue; // explicit, reviewable exception
  const src = stripComments(raw);
  src.split("\n").forEach((line, i) => {
    if (IDENTITY_CAPTURE.test(line)) {
      violations.push(
        `${r}:${i + 1}: identity capture on a PRE-RECALL surface. WIREFRAME §17: ` +
          `"no account, no email, no notification prompt until the learner has ` +
          `produced an ayah from memory." If this surface legitimately comes ` +
          `AFTER recall, add the marker ${PRE_RECALL_OPT_OUT} with a reason.`,
      );
    }
  });
}

// --- Clause 9: THE ENTITLEMENT-READ ALLOWLIST (edge case #124, v3-D55). ---
//
// "Events for an out-of-entitlement surah → ALWAYS ACCEPT — log is truth;
//  enforcement at issuance/corpus only."
//
// A paywall that drops evidence is the worst failure mode in this product: the
// dropped events do not error, do not retry, and never appear anywhere. The
// learner's memory graph is permanently and silently wrong, and no support
// ticket can reconstruct what was lost.
//
// The failure mode is concrete and cheap to write: someone adds
// `if (!entitled) return;` to the append or sync path, because it looks like
// obvious hygiene. Prose in a docblock has already failed this build five times
// (v3-D38/D45/D49/D50/D53), so the rule is STRUCTURAL: only the files below may
// even MENTION entitlement, and everything else fails the build by name.
//
// Mirrors clause 3 (indexedDB.open only in lib/idb/db.ts) and clause 6 (single
// egress), both of which have bitten.
// NOTE ON THIS PATTERN — it was WRONG on the first attempt and the inverse
// mutation caught it. The original was
//   /\b(Entitlement|entitlements|PaywallGate|entitled|EntitlementCache)\b/
// with a TRAILING \b, so `EntitlementSnapshot`, `EntitlementDecision` and
// `permitsIssuance(entitlementSnapshot)` all slipped through: the trailing word
// boundary requires the token to END there, and every real identifier in this
// codebase is a PREFIX of a longer name. The clause passed on files that read
// entitlement constantly — it was guarding almost nothing.
//
// Found by mutation-testing the INVERSE direction (removing a legitimate file
// from the allowlist and expecting a failure). It did not fail. That is exactly
// v3-D49's "a guard whose test never distinguished the states it guarded", and
// it is why both directions get mutated, not just the obvious one.
//
// Leading \b only: match the START of an identifier, let it continue.
const ENTITLEMENT_TOKENS = /\bEntitlement|\bentitlement|\bPaywall|\bentitled\b/;
// The THREE enforcement points (session assembly, corpus delivery, checkout),
// plus the entitlement island itself. Adding to this list is a reviewable act.
// NOTE: session assembly (`app/(app)/session/page.tsx`) is still a STUB at this
// step, so it is deliberately NOT here yet — an allowlist entry for a file that
// does not read entitlement is an unreviewed hole waiting for the real code. It
// gets added in the same commit that makes the session page a real enforcement
// point. Same for the checkout surface, which does not exist yet.
const ENTITLEMENT_ALLOWLIST = new Set([
  "lib/entitlement/cache.ts",
  "lib/entitlement/gate.ts",
  "lib/entitlement/types.ts",
  "lib/pricing.ts",
]);
// Named EXPLICITLY as forbidden, so the inverse mutation (removing one from the
// allowlist) has something to prove against. These are the ingestion and fold
// paths — the ones edge case #124 is about.
const ENTITLEMENT_FORBIDDEN = ["lib/idb/append.ts", "lib/sync/outbox.ts", "lib/sync/merge.ts", "lib/sync/sync.ts"];
for (const f of files) {
  const r = rel(f);
  if (r.endsWith(".test.ts") || r.endsWith(".test.tsx")) continue;
  if (ENTITLEMENT_ALLOWLIST.has(r)) continue;
  const src = stripComments(read(f));
  src.split("\n").forEach((line, i) => {
    if (ENTITLEMENT_TOKENS.test(line)) {
      violations.push(
        `${r}:${i + 1}: reads entitlement outside the allowlist. Edge case #124: ` +
          `events are ALWAYS ingested — the log is truth. Enforcement lives at ` +
          `session assembly, corpus delivery and checkout ONLY. If this file is a ` +
          `legitimate enforcement point, add it to ENTITLEMENT_ALLOWLIST here.`,
      );
    }
  });
}
// The allowlist must not rot into a list of files that no longer exist — a stale
// allowlist entry silently re-opens a hole when a path is later re-created.
for (const entry of ENTITLEMENT_ALLOWLIST) {
  if (!files.some((f) => rel(f) === entry)) {
    violations.push(`ENTITLEMENT_ALLOWLIST names ${entry}, which does not exist. Remove the stale entry.`);
  }
}
// And the forbidden list must actually name real files, or the clause is
// asserting nothing about the ingestion path (v3-D49's failure mode).
for (const entry of ENTITLEMENT_FORBIDDEN) {
  if (!files.some((f) => rel(f) === entry)) {
    violations.push(`ENTITLEMENT_FORBIDDEN names ${entry}, which does not exist. The clause is not guarding the ingestion path.`);
  }
  if (ENTITLEMENT_ALLOWLIST.has(entry)) {
    violations.push(`${entry} is in BOTH the entitlement allowlist and the forbidden list. Edge case #124 forbids it.`);
  }
}

// --- Clause 10: prices are written in ONE place (edge case #196). ---
// "config constants in ONE file + a test quoting v3-D07."
//
// The pricing test alone cannot catch this: it asserts the constants file is
// right, and stays green while a template hardcodes "RM20" beside it. The day
// pricing changes, the constants move and the template lies.
const PRICE_LITERAL = /(?<![\w.])(?:RM\s?\d|USD\s?\d|\$\d+(?:\.\d\d)?\s*(?:\/|per\s)\s*(?:mo|month|year))/i;
const PRICE_ALLOWLIST = new Set(["lib/pricing.ts"]);
for (const f of files) {
  const r = rel(f);
  if (r.endsWith(".test.ts") || r.endsWith(".test.tsx")) continue;
  if (PRICE_ALLOWLIST.has(r)) continue;
  const src = stripComments(read(f));
  src.split("\n").forEach((line, i) => {
    if (PRICE_LITERAL.test(line)) {
      violations.push(
        `${r}:${i + 1}: a price literal outside lib/pricing.ts. Edge case #196: ` +
          `pricing constants live in ONE file. A second copy is a copy that lies ` +
          `the day prices change.`,
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
