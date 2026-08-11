#!/usr/bin/env node
// GATE: every @font-face src must resolve to a file that EXISTS (plan §B3).
//
// Browsers fail an absent font fetch QUIETLY and fall back down the stack, so
// the page looks almost right and nobody notices the design system is not
// actually applied. That is the exact shape of a verification step that cannot
// fail, so this makes it fail.
//
// The policy is deliberately ASYMMETRIC, and that asymmetry is a product
// judgment, not an oversight:
//
//   Amiri missing            → HARD FAIL. The Arabic face IS the product. The
//                              ayah is the largest type on every screen; in a
//                              fallback serif it may render as tofu. A build
//                              without Amiri must never be publishable.
//   Inter / Source Serif 4   → WARN, loudly, every build. The UI degrades to
//                              `ui-sans-serif, system-ui` / `Georgia, serif`,
//                              which are the fallbacks the LOCKED stacks
//                              already name. Usable and honest.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const CSS = path.resolve(dir, "../app/iman-ui.css");
const PUBLIC = path.resolve(dir, "../public");
const DOCS = "public/fonts/FONTS.md";

const css = readFileSync(CSS, "utf8");

// Pair each @font-face's family/weight with its src url.
const blocks = [...css.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)].map((m) => m[1]);
const faces = [];
for (const b of blocks) {
  const family = /font-family:\s*"([^"]+)"/.exec(b)?.[1];
  const weight = /font-weight:\s*(\d+)/.exec(b)?.[1];
  const url = /src:\s*url\(\s*"([^"]+)"/.exec(b)?.[1];
  if (family && url) faces.push({ family, weight: weight ?? "?", url });
}

if (faces.length === 0) {
  console.error("\n✗ fonts gate FAILED\n\nNo @font-face rules found in app/iman-ui.css.\n");
  process.exit(1);
}

const missing = [];
const present = [];
for (const f of faces) {
  // Root-absolute `/fonts/...` resolves against public/, NOT the CSS file:
  // the CSS is emitted to /_next/static/css/<hash>.css, so a relative url
  // would 404.
  const abs = path.join(PUBLIC, f.url.replace(/^\//, ""));
  (existsSync(abs) ? present : missing).push({ ...f, abs });
}

const isCritical = (f) => /amiri/i.test(f.family);
const criticalMissing = missing.filter(isCritical);
const softMissing = missing.filter((f) => !isCritical(f));

const name = (f) => `${f.family} ${f.weight}`;
console.log(
  `fonts: ${present.length}/${faces.length} present` +
    (present.length ? ` (${present.map(name).join(", ")})` : "") +
    (missing.length ? `; ${missing.length} missing → see ${DOCS}` : ""),
);

if (softMissing.length > 0) {
  console.warn("\n⚠  MISSING UI FONTS — the build continues, degraded.\n");
  for (const f of softMissing) console.warn(`   ⚠  ${name(f)}  →  ${f.url}  (NOT FOUND)`);
  console.warn(
    `\n   These degrade to the fallbacks the locked token stacks already name\n` +
      `   (ui-sans-serif, system-ui / Georgia, serif). The page is usable.\n` +
      `   Acquisition commands: ${DOCS}\n`,
  );
}

if (criticalMissing.length > 0) {
  console.error("\n✗ fonts gate FAILED — the Arabic face is missing.\n");
  for (const f of criticalMissing) console.error(`   ✗  ${name(f)}  →  ${f.url}  (NOT FOUND)`);
  console.error(
    `\n   Amiri renders EVERY Arabic glyph in the app, and the ayah is the\n` +
      `   largest type on every screen. A fallback serif may lack Quranic\n` +
      `   codepoints entirely (tofu). This build must not be publishable.\n` +
      `   See ${DOCS}.\n`,
  );
  process.exit(1);
}
