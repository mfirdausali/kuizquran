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
//
// `lib/onboarding/` was ADDED at build-plan step 22 and it was a real hole, not
// a formality. The clause originally covered only `app/(onboarding)/` and
// `components/onboarding/` — the routes and the views. But the onboarding
// module that decides WHAT IS CAPTURED and writes it to the device lives in
// `lib/onboarding/`, and an email or password field is not the only way to
// break §17's rule: a `Notification.requestPermission()` in the commit path, or
// a capture helper added beside `commitOnboarding`, would be identity capture
// on a pre-recall surface with no markup anywhere near a view. Covering the
// views but not the module that serves them is covering the symptom.
//
// `components/sections/` joined this list with the landing-page refactor, for
// the same reason `lib/onboarding/` did: the clause must cover the file an
// email field would actually be typed into. Before the refactor that was
// `app/page.tsx`; afterwards the page holds no markup at all and every field on
// the pre-recall surface would be added to a section module instead. A clause
// naming only the page would have kept passing while the surface it guards
// moved out from under it.
const PRE_RECALL = [
  /^app\/page\.tsx$/,
  /^components\/sections\//,
  /^app\/\(onboarding\)\//,
  /^components\/onboarding\//,
  /^lib\/onboarding\//,
];
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

// --- Clause 11: v3-D19 — NO TAJWID CLAIM, NO REPLACES-A-TEACHER CLAIM. ---
//
//   "The app never claims to teach tajwid or replace a teacher. CI asserts no
//    landing or onboarding string makes either claim."          — v3-D19
//
// BUILD-PLAN names this a CI clause explicitly. Leaving it to prose is exactly
// the v3-D53 failure: "recall before identity" lived only in WIREFRAME.md and an
// adversarial review proved a landing-page email capture passed every gate and
// all 319 tests. A governing rule no check enforces is a rule that erodes.
//
// The detector is `lib/landing/claims.ts#findClaims`, imported here so the GATE
// and `test/landing-claims.test.ts` share ONE definition of "makes the claim".
// Two checks over one definition:
//
//   - the TEST runs it over the runtime VALUES of `landingStrings()` — what the
//     page will really paint, including anything assembled at render;
//   - this CLAUSE runs it over the SOURCE of every landing/onboarding-facing
//     file, so a claim written into JSX (rather than into the copy module,
//     where the test would see it) still fails the build.
//
// Neither check subsumes the other, which is why both exist.
//
// SCOPE. The landing page, the copy modules, the demo, and — when it lands —
// onboarding. v3-D19 says "landing or onboarding string", so the scope is those
// surfaces and not the whole app: an admin console or a defect note may
// legitimately discuss tajwid, and a checker that fired there would be a
// checker people learn to route around.
//
// `components/sections/` and `lib/i18n/` were ADDED when the landing page was
// refactored into a composition root with one module per §18 section. That
// refactor MOVED every landing sentence's render site out of `app/page.tsx`,
// and a scope that still named only the page would have been guarding an empty
// file: the page now holds a switch and no prose, while the eight section
// modules hold all of the markup a claim could be typed into. Leaving the scope
// unchanged would have turned a structural refactor into a silent removal of
// the v3-D19 check — green gate, no coverage, which is this build's documented
// failure mode.
const CLAIM_SCOPE = [
  /^app\/page\.tsx$/,
  /^lib\/landing\//,
  /^lib\/i18n\//,
  /^components\/landing\//,
  /^components\/sections\//,
  /^components\/demo\//,
  /^lib\/demo\//,
  /^app\/\(onboarding\)\//,
  /^components\/onboarding\//,
];
// The detector lives in lib/ (shared with the test) and is loaded dynamically
// because this gate is a plain .mjs script with no TypeScript transform. Rather
// than duplicate the patterns — the surest way to have two detectors that
// disagree — the source is READ and the pattern literals are extracted from it.
// A drift between the two is impossible because there is only one source text.
const CLAIMS_SRC_PATH = path.join(ROOT, "lib/landing/claims.ts");
let claimPatterns = null;
let dischargePatterns = null;
try {
  const claimsSrc = readFileSync(CLAIMS_SRC_PATH, "utf8");
  const extract = (constName) => {
    const block = claimsSrc.match(
      new RegExp(`const ${constName}:[^=]*=\\s*\\[([\\s\\S]*?)\\n\\];`),
    );
    if (!block) return null;
    const out = [];
    // Each entry is a regex literal on its own line: /.../i,
    for (const line of block[1].split("\n")) {
      const m = line.match(/^\s*(\/(?:[^/\\\n]|\\.)+\/[gimsuy]*)\s*,?\s*$/);
      if (m) out.push(m[1]);
    }
    return out.length > 0 ? out : null;
  };
  const toRegex = (literals) =>
    literals.map((lit) => {
      const last = lit.lastIndexOf("/");
      return new RegExp(lit.slice(1, last), lit.slice(last + 1));
    });
  const tajwid = extract("TAJWID_CLAIMS");
  const teacher = extract("TEACHER_CLAIMS");
  const memorized = extract("MEMORIZED_CLAIMS");
  const dischargers = extract("DISCHARGERS");
  if (!tajwid || !teacher || !memorized || !dischargers) {
    violations.push(
      `lib/landing/claims.ts: clause 11 could not extract its patterns. The ` +
        `v3-D19 claim check is NOT RUNNING. Keep TAJWID_CLAIMS / TEACHER_CLAIMS ` +
        `/ MEMORIZED_CLAIMS / DISCHARGERS as arrays of one-per-line regex literals.`,
    );
  } else {
    claimPatterns = toRegex([...tajwid, ...teacher, ...memorized]);
    dischargePatterns = toRegex(dischargers);
  }
} catch {
  violations.push(
    `lib/landing/claims.ts is missing. Clause 11 (v3-D19: no tajwid claim, no ` +
      `replaces-a-teacher claim) cannot run without it.`,
  );
}
/** The overlap rule, mirroring lib/landing/claims.ts#isDischarged. A negation
 *  overlapping the matched span is PART OF the claim, never a denial of it. */
function isDischargedAt(sentence, matchStart, matchEnd, dischargers) {
  for (const discharger of dischargers) {
    const flags = discharger.flags.includes("g") ? discharger.flags : `${discharger.flags}g`;
    const g = new RegExp(discharger.source, flags);
    let m;
    while ((m = g.exec(sentence)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (!(start < matchEnd && end > matchStart)) return true;
      if (m[0].length === 0) break;
    }
  }
  return false;
}
if (claimPatterns && dischargePatterns) {
  for (const f of files) {
    const r = rel(f);
    if (r.endsWith(".test.ts") || r.endsWith(".test.tsx")) continue;
    // The detector's OWN source names every banned phrasing, by necessity.
    if (r === "lib/landing/claims.ts") continue;
    if (!CLAIM_SCOPE.some((re) => re.test(r))) continue;
    // Comments are stripped: these modules DOCUMENT the prohibition, quoting the
    // very sentences they forbid. A gate that fires on its own rationale is the
    // one false positive guaranteed to get the gate deleted.
    const src = stripComments(read(f));
    // Sentence-scoped, exactly as findClaims is — a disclaimer in one sentence
    // must not launder a claim in the next.
    for (const sentence of src.split(/(?<=[.!?])\s+|\n+/)) {
      const trimmed = sentence.trim();
      if (trimmed.length === 0) continue;
      for (const pattern of claimPatterns) {
        const m = trimmed.match(pattern);
        if (!m || m.index === undefined) continue;
        // A discharging negation must sit OUTSIDE the matched span. Several
        // prohibited claims are negative in FORM ("no teacher needed", "never
        // forget it"), and a blanket "the sentence contains a negation" test
        // silently excused exactly those — the four most marketable
        // overclaims in the whole prohibition. Mirrors
        // lib/landing/claims.ts#isDischarged, which is where that bug was
        // caught by its MUST_FAIL tests.
        if (isDischargedAt(trimmed, m.index, m.index + m[0].length, dischargePatterns)) continue;
        violations.push(
          `${r}: v3-D19 violation — "${m[0]}". This app never claims to teach ` +
            `tajwid or replace a teacher, and never calls cued production ` +
            `"memorized" (WIREFRAME §21: the quiz is the daily driver; the ` +
            `teacher is the verifier). Offending sentence: "${trimmed.slice(0, 120)}"`,
        );
      }
    }
  }
}

// --- Clause 12: LANDING COPY IS DATA, NOT JSX. ---
//
// Clause 11 and the claim test are only as good as their reach, and their reach
// is "strings the copy module holds". The moment a sentence is typed directly
// into `app/page.tsx` as a JSX text node, it is still landing copy — but a
// reviewer scanning `lib/landing/copy.ts` will not see it, and a future
// claim-check refinement will not cover it.
//
// So: the landing page's markup may not contain prose. Every sentence comes
// from the copy module. What remains legal in the JSX is structure, class
// names, hrefs, and short non-sentence labels — which is why the trigger is a
// TEXT NODE containing sentence-shaped prose (several words), not any text at
// all.
//
// This is the same construction as clause 10 (a price literal outside
// lib/pricing.ts): the constants test alone stays green while a template
// hardcodes a second copy beside it.
//
// The eight §18 section modules are listed BY NAME rather than by a directory
// pattern. `components/sections/` is where landing markup lives, so a prefix
// match would be the tempting choice — but a named list fails loudly the day a
// ninth section is added without being registered here, whereas a prefix match
// would silently absorb it. The clause is about a list somebody must keep
// current, and a list that maintains itself cannot report that it wasn't.
const LANDING_MARKUP = [
  "app/page.tsx",
  "components/sections/Mechanism.tsx",
  "components/sections/Plan.tsx",
  "components/sections/Objections.tsx",
  "components/sections/Proof.tsx",
  "components/sections/Pricing.tsx",
];
// A named entry that no longer exists means the clause is silently guarding
// nothing — the same rot ENTITLEMENT_ALLOWLIST is checked for above.
for (const entry of LANDING_MARKUP) {
  if (!files.some((f) => rel(f) === entry)) {
    violations.push(
      `LANDING_MARKUP names ${entry}, which does not exist. Clause 12 is not ` +
        `guarding that file; remove the stale entry or restore the file.`,
    );
  }
}
// Every section module must be covered. A new file under components/sections/
// that clause 12 does not name is landing markup nobody is checking for prose.
for (const f of files) {
  const r = rel(f);
  if (!/^components\/sections\/.+\.tsx$/.test(r)) continue;
  if (r.endsWith(".test.tsx")) continue;
  if (!LANDING_MARKUP.includes(r)) {
    violations.push(
      `${r}: a landing section module that clause 12 does not name. Add it to ` +
        `LANDING_MARKUP, or its prose is invisible to the v3-D19 claim check.`,
    );
  }
}
// A JSX text node: `>` … `<` with no braces, holding 4+ words with a lowercase
// run — i.e. a sentence, not a `<span>Monthly</span>` label. Attribute values
// are not matched (they sit inside the tag, before the `>`).
const PROSE_TEXT_NODE = />\s*([A-Za-z][^<>{}]*?\s+[a-z]+[^<>{}]*?\s+[a-z]+[^<>{}]*?\s+[^<>{}]*?)\s*</;
for (const f of files) {
  const r = rel(f);
  if (!LANDING_MARKUP.includes(r)) continue;
  const src = stripComments(read(f));
  src.split("\n").forEach((line, i) => {
    const m = line.match(PROSE_TEXT_NODE);
    if (m && m[1].trim().split(/\s+/).length >= 4) {
      violations.push(
        `${r}:${i + 1}: prose in the landing markup — "${m[1].trim().slice(0, 60)}". ` +
          `Every landing sentence lives in lib/landing/copy.ts, so the v3-D19 ` +
          `claim check (clause 11 + test/landing-claims.test.ts) can actually ` +
          `see it. A sentence typed into JSX is invisible to both.`,
      );
    }
  });
}

// --- Clause 13: NO LEARNER-REACHABLE ROUTE READS THE ENGINE'S TEST FIXTURE. ---
//
// HANDOVER.md's §A-note ("the most consequential finding"): `lib/corpus/load.ts`
// used to read `packages/engine/test/fixtures/12.json` at request time — the
// engine's own UNFROZEN test data, cut before v3-D60's foil-dedup fix and
// carrying no `hashSpecVersion`. A learner on `/drill`, `/plan`, `/progress`,
// `/surah/[surah]` or `/workbench` was served content the content-freeze gate
// and the qari's tiered sign-off (v3-D13/v3-D22) can never certify, because the
// bytes served were never the bytes hashed. Fixed by repointing
// `lib/corpus/load.ts` at `packages/corpus-compiler/output/` (see that file).
//
// This clause is the standing guard: production code (app/, components/, lib/)
// must never reference the engine's test-fixtures path again, so the same
// defect cannot quietly return the next time a route needs "some real corpus
// data" and reaches for the nearest fixture instead of the compiled artifact.
// Scoped to app/components/lib (not the whole repo) so it never fires on the
// many legitimate `test/*.test.tsx` files that deliberately read the engine
// fixture as a source of REAL, non-authored Arabic bytes for driving
// components directly — that is INVARIANTS.md Absolute B's sacred-text rule
// working as intended, not the defect this clause guards against.
const ENGINE_FIXTURE_PATH = /packages\/engine\/test\/fixtures/;
for (const f of files.filter((f) => /^(app|components|lib)\//.test(rel(f)))) {
  const r = rel(f);
  if (r.endsWith(".test.ts") || r.endsWith(".test.tsx")) continue;
  const src = stripComments(read(f));
  src.split("\n").forEach((line, i) => {
    if (ENGINE_FIXTURE_PATH.test(line)) {
      violations.push(
        `${r}:${i + 1}: reads the engine's test fixture from production code. ` +
          `Learner-reachable routes must serve the FROZEN compiled corpus via ` +
          `lib/corpus/load.ts, never packages/engine/test/fixtures — see ` +
          `HANDOVER.md's §A-note and DECISIONS.md's step-20 completion entry.`,
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

console.log(
  `boundaries: OK — ${files.length} files checked (idb/client, sacred-text, ` +
    `engine-decision, egress, recall-before-identity, entitlement, pricing, v3-D19 claims, ` +
    `no-engine-fixture-in-production).`,
);
