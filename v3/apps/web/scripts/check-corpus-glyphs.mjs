#!/usr/bin/env node
// GATE: every Arabic codepoint in a compiled corpus must be mapped by the
// shipped Amiri glyph subset (BUILD-PLAN "Gates & checks" — per-corpus Amiri
// glyph-subset check; LAUNCH-CHECKLIST.md gate 21).
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARDS
// ---------------------------------------------------------------------------
// `public/fonts/FONTS.md` records Amiri's codepoint coverage as a fact VERIFIED
// MANUALLY, ONCE, on 2026-08-11 ("Read from the font's own name table... not
// from memory") — a count of codepoints per Unicode block, not a per-corpus
// check. A corpus codepoint the shipped font does not map renders as tofu
// (edge case #84) — on the ayah, the largest type on every screen, in the
// ONE surface invariant 5 calls out by name. Nothing before this gate re-runs
// that verification when a NEW surah compiles, or catches drift if the
// bundled Amiri subset ever changes.
//
// LAUNCH-CHECKLIST.md gate 21 named this "cheap to build" and marked it
// BLOCKED-ON-INFRA only because it "needs the final launch corpus set... to be
// meaningful" — that set closed at v3-D59/Q3 (12 + 67 + 103 + 112) and has been
// compiled since. The blocker no longer holds; this is that gate.
//
// ---------------------------------------------------------------------------
// HOW COVERAGE IS COMPUTED — NO NEW DEPENDENCY
// ---------------------------------------------------------------------------
// The shipped fonts are WOFF2. `cmap` (the table that maps a Unicode codepoint
// to a glyph) is stored UNTRANSFORMED inside a WOFF2's single Brotli stream —
// only `glyf`/`loca` undergo WOFF2's special reconstruction transform — so a
// minimal WOFF2 table-directory parser plus Node's built-in
// `zlib.brotliDecompressSync` is enough to recover real `cmap` bytes without a
// font-parsing dependency. Parses cmap formats 4 (BMP) and 12 (full Unicode,
// used by Amiri's platform 3/encoding 10 subtable for supplementary-plane
// marks). Self-check: run against the real shipped fonts, this parser
// reproduces FONTS.md's manually-verified counts exactly — U+0600-06FF: 254,
// U+0750-077F: 48, U+FB50-FDFF: 611, U+FE70-FEFF: 140, U+06D6-06ED: 24/24 (see
// `test/check-corpus-glyphs-gate.test.ts`).
//
// ---------------------------------------------------------------------------
// WHAT IS SCANNED, AND WHY NOT lemma/root
// ---------------------------------------------------------------------------
// `verses[].text_uthmani`, `words[].text_uthmani` and `distractors[].text` —
// the three fields a learner's browser actually paints (the same three arrays
// `stage-corpus.mjs#slim()` ships to a client, plus `text_uthmani` for surah 12
// which is server-rendered instead of staged). `words[].lemma`/`.root` are
// Arabic-script QAC morphology but `check-corpus-morphology.mjs` proves they
// never reach a browser (v3-D24) — scanning them here would demand coverage
// for glyphs nobody is ever asked to render.
//
// NOT ONE ARABIC BYTE IS WRITTEN IN THIS FILE. Every string this script reads
// comes from the compiled corpus at runtime; every codepoint this script PRINTS
// is a `U+XXXX` hex label, never the character itself — the sacred-text rule
// applies to what a human or model WRITES, but an error message quoting a
// codepoint number is not a text-write path and stays inside that discipline
// anyway.
//
// Usage:
//   node scripts/check-corpus-glyphs.mjs                     # real corpus + real fonts
//   node scripts/check-corpus-glyphs.mjs --json               # machine-readable
//   node scripts/check-corpus-glyphs.mjs --corpus-root <dir>  # override, for tests
//   node scripts/check-corpus-glyphs.mjs --fonts <p1>,<p2>    # override, for tests
//   node scripts/check-corpus-glyphs.mjs --surahs 12,67       # override, for tests
//
// Exit code: 0 when every scanned corpus's codepoints are covered, 1 on any
// gap or on a font that cannot be parsed. Exit 0 (with a loud warning) when the
// corpus has simply not been compiled yet — `output/` is gitignored (v3-D52)
// and this gate is wired into `npm run gates`, which must not break a clean
// checkout that has not run `make compile-corpus`.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, "..");
const DEFAULT_OUTPUT_ROOT = path.resolve(WEB_ROOT, "../../packages/corpus-compiler/output");
const DEFAULT_FONTS = [
  path.join(WEB_ROOT, "public/fonts/amiri-400.woff2"),
  path.join(WEB_ROOT, "public/fonts/amiri-700.woff2"),
];
// Mirrors `content-freeze.mjs#LAUNCH_SURAHS` / `Makefile#compile-corpus` — not
// re-imported, same reason `corpus-load.test.ts` gives: these are CLI entry
// points, not modules built to be imported.
const LAUNCH_SURAHS = [12, 67, 103, 112];

// ---------------------------------------------------------------------------
// WOFF2 → decompressed table bytes
// ---------------------------------------------------------------------------

const KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ",
  "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS",
  "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc",
  "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop",
  "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
];

/** WOFF2's UIntBase128: big-endian base-128 varint, 5 bytes max, no leading
 *  zero byte, MSB-of-final-byte-is-0 terminates. */
function readUIntBase128(buf, pos) {
  let result = 0;
  let i = 0;
  for (; i < 5; i++) {
    const b = buf[pos + i];
    if (i === 0 && b === 0x80) throw new Error("WOFF2: leading zero in UIntBase128");
    if (result & 0xfe000000) throw new Error("WOFF2: UIntBase128 overflow");
    result = (result << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) {
      i++;
      break;
    }
  }
  return [result >>> 0, pos + i];
}

/** Parses a WOFF2 file's table directory and returns {tag: Buffer} of
 *  DECOMPRESSED table bytes. `glyf`/`loca` may carry WOFF2's reconstruction
 *  transform and are returned in their (unreconstructed) transformed form —
 *  irrelevant here since only `cmap` is read, and `cmap` is never transformed. */
function parseWoff2Tables(buf) {
  if (buf.length < 48 || buf.readUInt32BE(0) !== 0x774f4632) {
    throw new Error("not a WOFF2 file (bad signature)");
  }
  const numTables = buf.readUInt16BE(12);
  const totalCompressedSize = buf.readUInt32BE(20);
  let pos = 48; // fixed WOFF2Header size
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos];
    pos += 1;
    const tagIdx = flags & 0x3f;
    let tag;
    if (tagIdx === 0x3f) {
      tag = buf.toString("latin1", pos, pos + 4);
      pos += 4;
    } else {
      tag = KNOWN_TAGS[tagIdx];
      if (tag == null) throw new Error(`WOFF2: unknown known-tag index ${tagIdx}`);
    }
    const transformVersion = (flags >> 6) & 0x3;
    let origLength;
    [origLength, pos] = readUIntBase128(buf, pos);
    let transformLength = null;
    // Per the WOFF2 spec: for glyf/loca, transform version 0 means
    // TRANSFORMED (an extra length follows); for every other table, any
    // NONZERO version means transformed. cmap is never transformed in
    // practice, but the directory is parsed generally regardless.
    const hasTransform = tag === "glyf" || tag === "loca" ? transformVersion === 0 : transformVersion !== 0;
    if (hasTransform) {
      [transformLength, pos] = readUIntBase128(buf, pos);
    }
    tables.push({ tag, origLength, transformLength });
  }
  const compressedStart = pos;
  const compressed = buf.subarray(compressedStart, compressedStart + totalCompressedSize);
  const decompressed = zlib.brotliDecompressSync(compressed);
  const result = {};
  let offset = 0;
  for (const t of tables) {
    const len = t.transformLength != null ? t.transformLength : t.origLength;
    result[t.tag] = decompressed.subarray(offset, offset + len);
    offset += len;
  }
  return result;
}

// ---------------------------------------------------------------------------
// cmap → covered codepoint set
// ---------------------------------------------------------------------------

/** Parses every subtable in a `cmap` table and unions the codepoints each one
 *  maps to a NON-NOTDEF glyph. Supports formats 4 (BMP segment mapping — every
 *  OS covers this) and 12 (full-Unicode groups — Amiri's platform 3/encoding
 *  10 subtable, needed for the U+06D6-06ED Quranic annotation marks above the
 *  BMP-adjacent range but still within it in Amiri's case, and future-proof for
 *  any supplementary-plane mark). An unsupported subtable format throws rather
 *  than silently omitting coverage — a false "covered" from a format this
 *  parser cannot read would be exactly this build's recurring vacuous-check
 *  shape, on the one path that renders the sacred text. */
function parseCmapCoverage(cmap) {
  if (cmap.length < 4) throw new Error("cmap table too short");
  const numTables = cmap.readUInt16BE(2);
  const covered = new Set();
  for (let i = 0; i < numTables; i++) {
    const rec = 4 + i * 8;
    const offset = cmap.readUInt32BE(rec + 4);
    const format = cmap.readUInt16BE(offset);
    if (format === 4) {
      const segCountX2 = cmap.readUInt16BE(offset + 6);
      const segCount = segCountX2 / 2;
      const endCodeOff = offset + 14;
      const startCodeOff = endCodeOff + segCountX2 + 2;
      const idDeltaOff = startCodeOff + segCountX2;
      const idRangeOff = idDeltaOff + segCountX2;
      for (let s = 0; s < segCount; s++) {
        const end = cmap.readUInt16BE(endCodeOff + s * 2);
        const start = cmap.readUInt16BE(startCodeOff + s * 2);
        if (start === 0xffff && end === 0xffff) continue;
        const idDelta = cmap.readInt16BE(idDeltaOff + s * 2);
        const idRangeOffset = cmap.readUInt16BE(idRangeOff + s * 2);
        for (let c = start; c <= end; c++) {
          let glyphId;
          if (idRangeOffset === 0) {
            glyphId = (c + idDelta) & 0xffff;
          } else {
            const glyphIndexAddr = idRangeOff + s * 2 + idRangeOffset + (c - start) * 2;
            glyphId = cmap.readUInt16BE(glyphIndexAddr);
            if (glyphId !== 0) glyphId = (glyphId + idDelta) & 0xffff;
          }
          if (glyphId !== 0) covered.add(c);
        }
      }
    } else if (format === 12) {
      const numGroups = cmap.readUInt32BE(offset + 12);
      for (let g = 0; g < numGroups; g++) {
        const go = offset + 16 + g * 12;
        const startChar = cmap.readUInt32BE(go);
        const endChar = cmap.readUInt32BE(go + 4);
        for (let c = startChar; c <= endChar; c++) covered.add(c);
      }
    } else if (format === 0 || format === 6) {
      // Legacy single-byte/trimmed-table formats a Latin-only subtable might
      // use; not expected in Amiri's Unicode subtables but harmless to skip
      // rather than fail the whole parse over a subtable this check does not
      // rely on (format 4/12 subtables carry the Unicode mapping this gate
      // reads; format 0/6 ones would be a legacy Mac/Windows-symbol subtable
      // alongside them, not instead of them).
      continue;
    } else {
      throw new Error(`cmap: unsupported subtable format ${format} — cannot verify coverage`);
    }
  }
  return covered;
}

/** Union of every codepoint any of the given WOFF2 fonts maps. */
function loadFontCoverage(fontPaths) {
  const covered = new Set();
  for (const p of fontPaths) {
    if (!existsSync(p)) throw new Error(`font not found: ${p}`);
    const tables = parseWoff2Tables(readFileSync(p));
    if (!tables.cmap) throw new Error(`${p}: no cmap table`);
    for (const c of parseCmapCoverage(tables.cmap)) covered.add(c);
  }
  return covered;
}

// ---------------------------------------------------------------------------
// Corpus → Arabic codepoints actually painted in a browser
// ---------------------------------------------------------------------------

/** Every codepoint in `s`, iterated by Unicode codepoint (not UTF-16 code
 *  unit, so surrogate-pair astral codepoints count once, correctly). */
function* codepointsOf(s) {
  for (const ch of s) yield ch.codePointAt(0);
}

/** Walks the three fields a browser actually paints and returns
 *  Map<codePoint, Array<{surah, field, source}>> — enough to name every site
 *  an uncovered codepoint came from, never the glyph itself. */
function collectCorpusCodepoints(surah, corpus) {
  const sites = new Map(); // codePoint -> [{field, ayah?, position?}]
  const note = (cp, field, loc) => {
    if (!sites.has(cp)) sites.set(cp, []);
    sites.get(cp).push({ field, ...loc });
  };
  for (const v of corpus.verses ?? []) {
    if (typeof v.text_uthmani !== "string") continue;
    for (const cp of codepointsOf(v.text_uthmani)) note(cp, "verses[].text_uthmani", { ayah: v.ayah });
  }
  for (const w of corpus.words ?? []) {
    if (typeof w.text_uthmani !== "string") continue;
    for (const cp of codepointsOf(w.text_uthmani)) {
      note(cp, "words[].text_uthmani", { ayah: w.ayah, position: w.position });
    }
  }
  for (const d of corpus.distractors ?? []) {
    if (typeof d.text !== "string") continue;
    for (const cp of codepointsOf(d.text)) note(cp, "distractors[].text", { ayah: d.ayah, position: d.position });
  }
  return sites;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const asJson = args.includes("--json");
function argVal(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const outputRoot = argVal("--corpus-root") ? path.resolve(argVal("--corpus-root")) : DEFAULT_OUTPUT_ROOT;
const fontPaths = argVal("--fonts")
  ? argVal("--fonts").split(",").map((p) => path.resolve(p))
  : DEFAULT_FONTS;
const surahs = argVal("--surahs")
  ? argVal("--surahs").split(",").map((s) => Number(s.trim())).filter(Number.isInteger)
  : LAUNCH_SURAHS;

function hex(cp) {
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

function fail(message) {
  if (asJson) {
    console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  } else {
    console.error(`\n✗ corpus-glyphs gate FAILED\n\n   ${message}\n`);
  }
  process.exit(1);
}

let coverage;
try {
  coverage = loadFontCoverage(fontPaths);
} catch (err) {
  fail(`could not read font coverage: ${err.message}`);
}

if (!existsSync(outputRoot)) {
  // output/ is gitignored (v3-D52) — a clean checkout that has not run
  // `make compile-corpus` has nothing to scan yet. This gate runs inside
  // `npm run gates`, which must survive that state, same posture as
  // `stage-corpus.mjs`'s own "never hard-fail on missing corpus" rule.
  console.warn(
    `corpus-glyphs: SKIPPED — no compiled corpus at ${path.relative(WEB_ROOT, outputRoot)}. ` +
      "Run `make compile-corpus` to actually verify glyph coverage.",
  );
  process.exit(0);
}

const found = [];
const missing = [];
const corpora = new Map();
for (const s of surahs) {
  const file = path.join(outputRoot, String(s), "corpus.json");
  if (!existsSync(file)) {
    missing.push(s);
    continue;
  }
  try {
    corpora.set(s, JSON.parse(readFileSync(file, "utf8")));
    found.push(s);
  } catch (err) {
    fail(`surah ${s}: corpus.json is unreadable (${err.message})`);
  }
}

if (found.length === 0) {
  // `output/` exists but nothing under it parsed — a genuine anomaly (a
  // healthy `compile-corpus` writes all launch surahs together), not the
  // ordinary "not compiled yet" state above. A silent 0-scanned "OK" here
  // would be exactly the vacuous pass this build has shipped before —
  // fail loudly instead.
  fail(
    `${path.relative(WEB_ROOT, outputRoot)} exists but none of surahs ${surahs.join(", ")} compiled under it. ` +
      "Run `make compile-corpus`.",
  );
}
if (missing.length > 0) {
  console.warn(`corpus-glyphs: surah(s) ${missing.join(", ")} not compiled — scanning the rest.`);
}

const uncoveredFindings = [];
let codepointsChecked = 0;
for (const [surah, corpus] of corpora) {
  const sites = collectCorpusCodepoints(surah, corpus);
  codepointsChecked += sites.size;
  for (const [cp, locs] of sites) {
    if (!coverage.has(cp)) {
      uncoveredFindings.push({ surah, codePoint: hex(cp), occurrences: locs.length, sites: locs.slice(0, 3) });
    }
  }
}

const ok = uncoveredFindings.length > 0 ? false : true;

if (asJson) {
  console.log(
    JSON.stringify(
      {
        ok,
        surahsChecked: found,
        surahsMissing: missing,
        fontsUsed: fontPaths.map((p) => path.relative(WEB_ROOT, p)),
        fontCodepointsMapped: coverage.size,
        distinctCodepointsChecked: codepointsChecked,
        uncovered: uncoveredFindings,
      },
      null,
      2,
    ),
  );
} else if (ok) {
  console.log(
    `corpus-glyphs: OK — ${found.length} corpus artifact(s) (surahs ${found.join(", ")}), ` +
      `${codepointsChecked} distinct codepoint(s) checked, all mapped by the shipped Amiri subset ` +
      `(${coverage.size} codepoints across ${fontPaths.length} font file(s)).`,
  );
} else {
  console.error(
    "\n✗ corpus-glyphs gate FAILED — a compiled corpus contains a codepoint the shipped Amiri\n" +
      "  subset does not map. Rendered, it is tofu — on the ayah, the largest type on every screen.\n",
  );
  for (const f of uncoveredFindings) {
    console.error(`   ✗  surah ${f.surah}  ${f.codePoint}  (${f.occurrences} occurrence(s))`);
    for (const loc of f.sites) {
      console.error(`         ${f.codePoint} at ${loc.field}${loc.ayah != null ? ` ayah ${loc.ayah}` : ""}${loc.position != null ? ` position ${loc.position}` : ""}`);
    }
  }
  console.error(`\n   See ${path.relative(WEB_ROOT, path.join(WEB_ROOT, "public/fonts/FONTS.md"))}.\n`);
}

process.exit(ok ? 0 : 1);
