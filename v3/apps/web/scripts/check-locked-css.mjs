#!/usr/bin/env node
// GATE: iman-ui.css is LOCKED (plan §B5).
//
// A STRUCTURAL gate, not a hash comparison — a hash can only say "differs",
// never "differs by exactly this". This asserts the copy equals v1 line-for-
// line EXCEPT one contiguous replacement at line 17, where the Google Fonts
// @import became self-hosted @font-face rules.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const V1 = path.resolve(dir, "../../../../v1/styles/iman-ui.css");
const COPY = path.resolve(dir, "../app/iman-ui.css");

/** v1 is FROZEN. Pinned so a violation of the frozen-tree rule is reported as
 *  itself, not as a confusing diff against a moved target. */
const V1_SHA256 = "d955c44584e03c6e56672cdd67115b771469e543ead0ac0ca7998832dae48311";
// `wc -l` counts newline CHARACTERS (293); a trailing newline makes
// split("\n") yield one extra, empty, final element. The sha256 above is the
// real integrity check — this is a shape sanity check, so it must agree with
// how the value is actually computed.
const V1_LINES = 294;
const V1_BYTES = 10478;
/** 1-based line of the @import in v1 — the ONE permitted delta. */
const IMPORT_LINE = 17;
/** Token lines that name the LITERAL font families. Editing these is what
 *  next/font would have forced (hashed family names), and it is forbidden. */
const TOKEN_LINES = [72, 73, 74];

const EXPECTED_FACES = [
  ["Amiri", "400"],
  ["Amiri", "700"],
  ["Inter", "400"],
  ["Inter", "500"],
  ["Inter", "600"],
  ["Source Serif 4", "400"],
];

const RULE =
  'iman-ui.css is LOCKED. The @import→@font-face replacement at line 17 is the\n' +
  "ONE permitted delta (edge case #83). Put every other change in app/iman-ext.css.";

function fail(msg, detail = "") {
  console.error(`\n✗ locked-css gate FAILED\n\n${msg}\n${detail ? detail + "\n" : ""}\n${RULE}\n`);
  process.exit(1);
}

const v1Raw = readFileSync(V1);
const sha = createHash("sha256").update(v1Raw).digest("hex");
if (sha !== V1_SHA256) {
  fail(
    "v1/styles/iman-ui.css ITSELF CHANGED — the frozen tree was modified.",
    `expected sha256 ${V1_SHA256}\n     got sha256 ${sha}`,
  );
}

const v1Text = v1Raw.toString("utf8");
const v1Lines = v1Text.split("\n");
if (v1Lines.length !== V1_LINES || v1Raw.length !== V1_BYTES) {
  fail(
    "v1/styles/iman-ui.css changed shape (frozen tree violated).",
    `expected ${V1_LINES} lines / ${V1_BYTES} bytes; got ${v1Lines.length} / ${v1Raw.length}`,
  );
}

const copyLines = readFileSync(COPY, "utf8").split("\n");

// --- Everything BEFORE the delta must be byte-identical, in order. ---
for (let i = 0; i < IMPORT_LINE - 1; i++) {
  if (copyLines[i] !== v1Lines[i]) {
    fail(`Line ${i + 1} differs, before the permitted delta.`, `v1:   ${v1Lines[i]}\ncopy: ${copyLines[i]}`);
  }
}

// --- The deleted line must be exactly the Google Fonts @import. ---
const deleted = v1Lines[IMPORT_LINE - 1];
if (!/^@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Amiri/.test(deleted)) {
  fail(`v1 line ${IMPORT_LINE} is not the expected @import.`, `got: ${deleted}`);
}

// --- The tail must realign to v1 line 18 exactly once. ---
const tail = v1Lines.slice(IMPORT_LINE); // v1 lines 18..end
const tailStart = copyLines.length - tail.length;
if (tailStart < IMPORT_LINE - 1) {
  fail("The copy is shorter than v1 minus the @import — content was deleted.");
}
for (let i = 0; i < tail.length; i++) {
  if (copyLines[tailStart + i] !== tail[i]) {
    fail(
      `Line ${tailStart + i + 1} of the copy differs from v1 line ${IMPORT_LINE + 1 + i}.`,
      `v1:   ${tail[i]}\ncopy: ${copyLines[tailStart + i]}`,
    );
  }
}

// --- The inserted block: exactly one hunk, replacing exactly that line. ---
const inserted = copyLines.slice(IMPORT_LINE - 1, tailStart);
if (inserted.length === 0) {
  fail("The @import was deleted but no @font-face block replaced it.", "Fonts would silently not load.");
}

const insertedText = inserted.join("\n");

// The block documents the @import it replaced, quoting it inside a comment —
// that quotation is the point of the delta and must not trip the gate. So
// strip comments first and check the ACTIVE CSS. A real CDN reference lives
// in a src:/@import at the top level and is still caught.
const activeCss = insertedText.replace(/\/\*[\s\S]*?\*\//g, "");

// This is the clause that actually enforces "offline-safe". A future agent
// restoring a CDN reference in ANY form fails here.
if (/@import/.test(activeCss)) {
  fail("The replacement block contains an ACTIVE @import. Offline builds must not fetch fonts.");
}
if (/https?:/i.test(activeCss)) {
  fail(
    "The replacement block references a remote URL in active CSS.",
    "Fonts MUST be self-hosted from /public/fonts — a CDN reintroduces exactly\nthe offline breakage that killed the @import.",
  );
}
// Every src must be a root-absolute local path, positively asserted (a
// negative check alone would pass a protocol-relative //fonts.gstatic.com url).
for (const m of activeCss.matchAll(/src:\s*url\(\s*"([^"]*)"/g)) {
  if (!/^\/fonts\//.test(m[1])) {
    fail(`A @font-face src is not a local /fonts/ path: ${m[1]}`, "Self-hosted files only.");
  }
}

// --- The delta cannot quietly grow into a design change. ---
const faces = [...insertedText.matchAll(/font-family:\s*"([^"]+)"[\s\S]*?font-weight:\s*(\d+)/g)].map(
  (m) => [m[1], m[2]],
);
const got = faces.map((f) => f.join(" ")).sort();
const want = EXPECTED_FACES.map((f) => f.join(" ")).sort();
if (got.length !== want.length || got.some((f, i) => f !== want[i])) {
  fail("The @font-face block does not declare exactly the six expected faces.", `expected: ${want.join(", ")}\ngot:      ${got.join(", ")}`);
}

// --- Token lines: covered by the tail check, but given their OWN message,
// because that message is what tells the next agent WHY they cannot rename a
// family (next/font's hashed names can never match these literals). ---
for (const n of TOKEN_LINES) {
  const copyIdx = tailStart + (n - (IMPORT_LINE + 1));
  if (copyLines[copyIdx] !== v1Lines[n - 1]) {
    fail(
      `Font TOKEN line ${n} was edited.`,
      `--font-ui / --font-arabic / --font-voice name the LITERAL families that\n` +
        `the @font-face block declares. Renaming one breaks the design system.\n` +
        `v1:   ${v1Lines[n - 1]}\ncopy: ${copyLines[copyIdx]}`,
    );
  }
}

console.log(
  `locked-css: OK — 1 hunk at line ${IMPORT_LINE} (@import → ${faces.length} @font-face), ` +
    `${v1Lines.length} v1 lines otherwise byte-identical.`,
);
