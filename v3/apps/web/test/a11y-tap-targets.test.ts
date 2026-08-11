// M10 LAUNCH HARDENING — THE TAP-TARGET FLOOR, ASSERTED AS A COMPUTED HEIGHT.
//
// WIREFRAME §15: "Tap targets >=44px (already v2-D28)."
//
// ---------------------------------------------------------------------------
// WHY THIS TEST COMPUTES A NUMBER INSTEAD OF GREPPING FOR `--tap-min`
// ---------------------------------------------------------------------------
// The obvious version of this test greps the stylesheets for `min-height:
// var(--tap-min)` and counts the hits. That test passes on a codebase where the
// floor is declared on classes nobody renders and ABSENT from the one control
// every quiz screen is made of — which is exactly the state this file was
// written to catch. `.tile` carried the floor (via `.tile-hit`), `.option` did
// not, and a grep-shaped test would have been green throughout.
//
// So this asserts the OUTPUT: for each control, the height a browser would
// actually lay out, derived from the winning declarations across BOTH
// stylesheets in cascade order. A control that renders 39px tall fails here
// even while `--tap-min: 44px` sits in the file three blocks above it.
//
// The locked file cannot be edited (byte-gated against v1), so when a locked
// control misses the floor the fix necessarily lands in `iman-ext.css` — and
// this test reads both files in the same order `layout.tsx` imports them,
// which is what makes "the ext layer raised the floor" a provable claim rather
// than an assumed one.
//
// NO ARABIC IS TYPED HERE. This file reads CSS, not corpus text.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "..", "app");

/** The two stylesheets, in the ONE order `app/layout.tsx` imports them.
 *  Order is load-bearing: the ext layer wins ties only because it is second. */
const LOCKED = readFileSync(join(appDir, "iman-ui.css"), "utf8");
const EXT = readFileSync(join(appDir, "iman-ext.css"), "utf8");
const CASCADE = `${LOCKED}\n${EXT}`;

const FLOOR_PX = 44;

/** Strip comments so a `44` inside prose can never satisfy an assertion. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

interface Rule {
  selectors: string[];
  decls: Record<string, string>;
}

/** A deliberately small flat-rule parser. It ignores at-rule BLOCKS (@media,
 *  @keyframes, @font-face) by skipping any brace group whose "selector" starts
 *  with `@` — none of the controls under test get their box from inside one,
 *  and pulling in a real CSS parser for this would add a dependency to a
 *  frozen lockfile. */
function parseRules(css: string): Rule[] {
  const src = stripComments(css);
  const rules: Rule[] = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open === -1) break;
    const selectorText = src.slice(i, open).trim();

    // Walk to the matching close brace so nested at-rule blocks are consumed
    // whole rather than being mis-split at their first inner `}`.
    let depth = 1;
    let j = open + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
      j++;
    }
    const body = src.slice(open + 1, j - 1);

    if (!selectorText.startsWith("@")) {
      const decls: Record<string, string> = {};
      for (const part of body.split(";")) {
        const idx = part.indexOf(":");
        if (idx === -1) continue;
        const prop = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (prop) decls[prop] = value;
      }
      rules.push({
        selectors: selectorText.split(",").map((s) => s.trim()).filter(Boolean),
        decls,
      });
    }
    i = j;
  }
  return rules;
}

const RULES = parseRules(CASCADE);

/** Resolve `var(--token)` against `:root` (one level is all this file uses). */
function resolveVars(value: string): string {
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (_m, token: string) => {
    for (let k = RULES.length - 1; k >= 0; k--) {
      const r = RULES[k];
      const declared = r?.decls[token];
      if (r?.selectors.includes(":root") && declared !== undefined) {
        return declared;
      }
    }
    return "";
  });
}

/** The px magnitude of one whitespace-separated length token, or 0. */
function pxIn(token: string | undefined): number {
  const m = (token ?? "").match(/(-?[\d.]+)px/);
  return m?.[1] === undefined ? 0 : Number(m[1]);
}

function px(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const m = resolveVars(value).match(/(-?[\d.]+)px/);
  return m ? Number(m[1]) : undefined;
}

/**
 * The LAST declaration wins — which is precisely how the cascade resolves two
 * rules of equal specificity, and why the ext layer must be concatenated second.
 */
function winning(selector: string, prop: string): string | undefined {
  let out: string | undefined;
  for (const r of RULES) {
    if (r.selectors.includes(selector) && r.decls[prop] !== undefined) {
      out = r.decls[prop];
    }
  }
  return out;
}

/** Shorthand `padding` -> the block (top+bottom) contribution. */
function paddingBlock(selector: string): number {
  const shorthand = winning(selector, "padding");
  if (shorthand) {
    const parts = resolveVars(shorthand).trim().split(/\s+/);
    const top = pxIn(parts[0]);
    const bottom = parts.length >= 3 ? pxIn(parts[2]) : top;
    return top + bottom;
  }
  const t = px(winning(selector, "padding-top")) ?? 0;
  const b = px(winning(selector, "padding-bottom")) ?? 0;
  return t + b;
}

/** Border, both edges. `--hairline` resolves to a px length. */
function borderBlock(selector: string): number {
  const shorthand = winning(selector, "border");
  if (!shorthand) return 0;
  if (/\bnone\b/.test(resolveVars(shorthand))) return 0;
  const w = px(shorthand);
  return w === undefined ? 0 : w * 2;
}

const BODY_FONT_PX = px(winning("body", "font-size")) ?? 14;
const BODY_LINE_HEIGHT = Number(resolveVars(winning("body", "line-height") ?? "1.5"));

/**
 * The height a browser lays out for one line of text in this control, BEFORE
 * any `min-height` floor is applied. This is what a control is when nobody
 * raised its minimum.
 */
function naturalHeight(selector: string): number {
  const fontPx = px(winning(selector, "font-size")) ?? BODY_FONT_PX;
  const lh = Math.round(fontPx * BODY_LINE_HEIGHT);
  return lh + paddingBlock(selector) + borderBlock(selector);
}

/** What the control ACTUALLY renders as: the larger of its natural height and
 *  whatever floor the cascade (locked + ext) ended up giving it. */
function effectiveHeight(selector: string): number {
  const floor = px(winning(selector, "min-height")) ?? 0;
  const explicit = px(winning(selector, "height"));
  return Math.max(naturalHeight(selector), floor, explicit ?? 0);
}

describe("§15 / v2-D28 — every interactive control clears the 44px floor", () => {
  /**
   * The controls a learner or operator actually taps. Each is a class that a
   * component in `components/**` puts on a <button>, an <input> or a link.
   *
   * `.option` is the one that matters most: it is the entire answer surface of
   * the `choice` and `locateChoice` shapes, so a learner taps it more than
   * every other control in this list combined.
   */
  const CONTROLS = [
    ".option",
    ".btn",
    ".tile-hit",
    ".hit",
    ".th-sort",
    ".row-link",
    ".wb-row",
    ".drill-input",
    ".tabbar__item",
    ".table-toolbar__input",
  ];

  it.each(CONTROLS)("%s renders at least 44px tall", (selector) => {
    expect(effectiveHeight(selector)).toBeGreaterThanOrEqual(FLOOR_PX);
  });

  /**
   * THE REGRESSION THIS FILE EXISTS FOR.
   *
   * `.option` is a LOCKED rule (iman-ui.css:269): `padding: 9px 12px` around a
   * 14px/1.5 line, plus two 0.5px hairlines = 40px. Under the floor, on the
   * single most-tapped control in the product, and unfixable in place because
   * the locked file is byte-gated. The repair therefore HAS to come from the
   * ext layer — and if someone deletes that ext rule, a grep-shaped test would
   * still pass while every quiz screen dropped back under 44px.
   *
   * Asserting that the shortfall exists in the locked file AND is repaired by
   * the cascade is what makes the repair itself the thing under test.
   *
   * (`.btn` is deliberately NOT in this list: 11+11 padding + 21 line + two
   * hairlines = exactly 44px, so it already met the floor on locked
   * declarations alone. The ext rule keeps it there rather than rescuing it —
   * and asserting a shortfall that does not exist would be a false claim.)
   */
  it.each([".option"])(
    "%s is under the floor on the locked file's own declarations, and is raised by the ext layer",
    (selector) => {
      const lockedOnly = parseRules(LOCKED);
      let lockedPadding = 0;
      let lockedFont = BODY_FONT_PX;
      let lockedFloor = 0;
      for (const r of lockedOnly) {
        if (!r.selectors.includes(selector)) continue;
        if (r.decls.padding) {
          const parts = r.decls.padding.trim().split(/\s+/);
          const top = pxIn(parts[0]);
          const bottom = parts.length >= 3 ? pxIn(parts[2]) : top;
          lockedPadding = top + bottom;
        }
        if (r.decls["font-size"]) lockedFont = px(r.decls["font-size"]) ?? lockedFont;
        if (r.decls["min-height"]) lockedFloor = px(r.decls["min-height"]) ?? 0;
      }
      const lockedNatural =
        Math.round(lockedFont * BODY_LINE_HEIGHT) + lockedPadding + borderBlock(selector);

      // The locked file does not, on its own, reach 44px.
      expect(Math.max(lockedNatural, lockedFloor)).toBeLessThan(FLOOR_PX);

      // The full cascade does.
      expect(effectiveHeight(selector)).toBeGreaterThanOrEqual(FLOOR_PX);
    },
  );

  /**
   * `display: flex` makes `text-align` inert. The locked `.option--arabic`
   * aligns Arabic with `text-align: right`, so the moment `.option` became a
   * flex container that declaration stopped doing anything — and every Arabic
   * option would have left-aligned inside an RTL box.
   *
   * `justify-content: flex-start` under the locked `direction: rtl` resolves to
   * the right edge, so ONE declaration reproduces both alignments. This asserts
   * the pairing: if `.option` is flex, it must carry a flex alignment too.
   */
  it("if .option is a flex container it restates its alignment in flex terms", () => {
    const display = winning(".option", "display");
    if (display && /flex/.test(display)) {
      expect(winning(".option", "justify-content")).toBeDefined();
    }
    // The locked RTL alignment must still be expressed somewhere.
    expect(winning(".option--arabic", "direction")).toBe("rtl");
  });
});

describe("§15 — every class a component renders is actually defined", () => {
  /**
   * `btn--quiet` shipped on the progress table's empty-state button and was
   * defined by NO stylesheet, so the control rendered as a full-width default
   * `.btn` in the middle of a sentence. A class name that matches nothing is
   * invisible to typechecking, to the linter and to every render test that
   * queries by role — it can only be caught by comparing the two sets.
   */
  it("no component references a `btn--*` or `option--*` modifier that no stylesheet defines", async () => {
    const { readdirSync, statSync } = await import("node:fs");
    const roots = [join(here, "..", "components"), join(here, "..", "app")];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(p)) files.push(p);
      }
    };
    roots.forEach(walk);

    const defined = new Set<string>();
    for (const r of RULES) {
      for (const sel of r.selectors) {
        for (const m of sel.matchAll(/\.([\w-]+)/g)) {
          const name = m[1];
          if (name !== undefined) defined.add(name);
        }
      }
    }

    const missing: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // Only className string literals — never comments or prose.
      for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const classes = (m[1] ?? m[2] ?? "").split(/\s+/).filter(Boolean);
        for (const c of classes) {
          if (!/^(btn|option)--/.test(c)) continue;
          if (!defined.has(c)) missing.push(`${c} (in ${file.split("/").slice(-2).join("/")})`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
