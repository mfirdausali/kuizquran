// D — THE A11Y ASSERTIONS ONLY A BROWSER CAN MAKE.
//
// This file exists because `test/a11y-tap-targets.test.ts` is a GREP. It reads
// CSS text and asserts that rules mentioning `min-height` name 44px. That
// cannot see a `.option` that renders at 40px, because the number a thumb hits
// is produced by the CASCADE, the box model, the font, and the viewport —
// none of which a regex over a stylesheet evaluates.
//
// Everything here is measured from `getBoundingClientRect()` on a LAID-OUT
// element in a real engine at a real phone viewport (the `mobile` project in
// playwright.config.ts — Pixel 7). A tap target is a claim about a thumb, and a
// thumb is on a phone; measuring at desktop width would certify a layout no
// learner uses.
//
// ---------------------------------------------------------------------------
// THE HIT AREA IS THE LABEL, NOT THE INPUT
// ---------------------------------------------------------------------------
// The drill mode radios are 13x13 CSS pixels — the UA default, unstyled. That
// number is irrelevant and asserting on it would be wrong: each is wrapped in
// a `<label class="drill-mode">` that measures 320x49, and a tap anywhere in
// that label activates the input. So the measurement walks UP to the labelling
// ancestor before judging, which is what the platform actually does.
//
// This is the same substance as edge case #82 ("44px targets vs locked ~32px
// .tile" -> "transparent .tile-hit wrapper in ext layer"): the locked visual
// box stays small, and a wrapper carries the touch area. A geometry test has
// to understand that pattern or it will fail every correct implementation of
// it.

import { expect, test, type Locator, type Page } from "@playwright/test";

const MIN = 44; // WCAG 2.5.5 Target Size (Enhanced) / the wireframe's own floor

/** Elements that are exempt, with the reason. Anything not listed is judged. */
const EXEMPT = [
  // The skip link is visually hidden until focused — it is 98x21 while
  // off-screen and is not a target a thumb aims at. WCAG 2.5.5 explicitly
  // excludes targets that are not exposed. It is tested separately, by
  // KEYBOARD, which is the modality that actually uses it.
  ".skip-link",
];

interface Measured {
  desc: string;
  w: number;
  h: number;
  /** True when the control declares `width: 100%` — its width is its
   *  container's business, not its own. See expectAllTargetsBigEnough. */
  fullWidth: boolean;
}

/**
 * Measure every interactive element's EFFECTIVE hit area on the current page.
 *
 * "Effective" = the element's own box, or its labelling ancestor's box when
 * that ancestor is what receives the tap (a `<label>` wrapping an input, or an
 * `.hit`/`.tile-hit` wrapper). Max of the two, because either one being large
 * enough makes the target large enough.
 */
async function measureTargets(page: Page): Promise<Measured[]> {
  return page.evaluate((exempt) => {
    const SELECTOR =
      'a[href], button, input[type="radio"], input[type="checkbox"], ' +
      'input[type="number"], input[type="text"], select, textarea, ' +
      '[role="button"], [role="radio"], [role="checkbox"], summary';

    const out: Array<{ desc: string; w: number; h: number; fullWidth: boolean }> = [];

    for (const el of Array.from(document.querySelectorAll(SELECTOR))) {
      if (exempt.some((sel) => el.matches(sel) || el.closest(sel))) continue;

      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;

      const own = el.getBoundingClientRect();
      if (own.width === 0 && own.height === 0) continue;

      // Walk up to the box that actually receives the tap.
      const wrapper =
        el.closest("label") ??
        el.closest(".hit") ??
        el.closest(".tile-hit") ??
        null;
      const wrap = wrapper?.getBoundingClientRect();

      const w = Math.max(own.width, wrap?.width ?? 0);
      const h = Math.max(own.height, wrap?.height ?? 0);

      const text = (el.textContent ?? "").trim().slice(0, 30);
      const cls = typeof el.className === "string" ? el.className.slice(0, 30) : "";
      out.push({
        desc: `<${el.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ""}>${text}`,
        w: Math.round(w),
        h: Math.round(h),
        // `getComputedStyle().width` resolves to PIXELS, so the declaration
        // `width: 100%` is not readable there. Detect it structurally: a
        // control that exactly fills its parent's CONTENT box (border box
        // minus padding — not the border box, which is what an earlier version
        // of this compared against and got wrong for every padded `<th>`) is
        // one whose width its container decides.
        fullWidth: (() => {
          const parent = el.parentElement;
          if (!parent) return false;
          const ps = getComputedStyle(parent);
          const contentWidth =
            parent.getBoundingClientRect().width -
            parseFloat(ps.paddingLeft || "0") -
            parseFloat(ps.paddingRight || "0");
          return Math.abs(own.width - contentWidth) < 1.5;
        })(),
      });
    }
    return out;
  }, EXEMPT);
}

/**
 * The floor is on HEIGHT, and on width only where width is the element's own
 * business.
 *
 * WHY NOT BOTH, ALWAYS: a table column header's width is the COLUMN's, not the
 * button's — `.th-sort` is `width: 100%`, so a narrow column ("Kind", 40px)
 * produces a narrow button no matter what the button's own rules say. WCAG
 * 2.5.5 is about the area a finger must land in; for a full-width control in a
 * narrow column the row/column geometry supplies the context, and the
 * actionable, fixable property is the height.
 *
 * So width is asserted for free-standing controls (tiles, buttons, links) and
 * relaxed for controls that are declared `width: 100%` of a container that
 * sizes them. The relaxation is NARROW and it is named, rather than being a
 * blanket "height only" that would hide a genuinely 20x20 icon button.
 */
async function expectAllTargetsBigEnough(page: Page, route: string) {
  const targets = await measureTargets(page);
  expect(targets.length, `${route} has interactive elements to measure`).toBeGreaterThan(0);

  const small = targets.filter((t) => (t.fullWidth ? t.h < MIN : t.h < MIN || t.w < MIN));
  expect(
    small,
    `${route}: targets under ${MIN}px, measured from LAID-OUT geometry at a ` +
      `phone viewport (not from a CSS grep):\n` +
      small.map((s) => `  ${s.w}x${s.h}  ${s.desc}`).join("\n"),
  ).toEqual([]);
}

test.describe("D · a11y, measured from laid-out geometry", () => {
  test("landing: every tap target is at least 44px", async ({ page }) => {
    await page.goto("/");
    await expectAllTargetsBigEnough(page, "/");
  });

  test("onboarding: every tap target is at least 44px", async ({ page }) => {
    await page.goto("/start");
    await expectAllTargetsBigEnough(page, "/start");
  });

  test("drill picker: every tap target is at least 44px", async ({ page }) => {
    await page.goto("/drill");
    await expect(page.locator(".drill-summary")).toBeVisible();
    await expectAllTargetsBigEnough(page, "/drill");
  });

  test("progress list: every tap target is at least 44px", async ({ page }) => {
    // THE ROUTE THIS SWEEP EXISTED TO COVER AND ORIGINALLY MISSED.
    //
    // Added after a mutation run: setting `.th-sort { min-height: 0 }` in the
    // ext layer and REBUILDING left all ten tests green, because no sweep
    // visited /progress/list. The eight column-sort buttons are the densest
    // cluster of controls in the product and they sit EXACTLY at 44px — the
    // tightest binding constraint anywhere in the app, and therefore the one
    // most likely to be broken by an innocent CSS edit. With this test, that
    // same mutation goes red.
    //
    // This is also the concrete answer to why a CSS grep is not enough: the
    // grep in test/a11y-tap-targets.test.ts reads the RULE and would still see
    // `min-height` declared. Only the laid-out box knows the button is 12px.
    await page.goto("/progress/list");
    await expect(page.locator("table")).toBeVisible();
    await expectAllTargetsBigEnough(page, "/progress/list");
  });

  test("the drill mode radios are hit-sized by their labels, not their inputs", async ({
    page,
  }) => {
    await page.goto("/drill");

    // The specific pattern edge case #82 prescribes, asserted on the real box:
    // a small styled control inside a large touch wrapper. If someone ever
    // "fixes" this by removing the label wrapper, the generic sweep above
    // catches it — this test names WHY it was passing.
    const label = page.locator("label.drill-mode").first();
    const box = await label.boundingBox();
    expect(box, "the radio's label is laid out").not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(MIN);
    expect(box!.width).toBeGreaterThanOrEqual(MIN);

    // And it genuinely activates the input — a big box that does nothing is
    // worse than a small one that works.
    await label.click();
    await expect(label.locator('input[type="radio"]')).toBeChecked();
  });

  test("the landing demo's Arabic tiles clear 44px via the .tile-hit wrapper", async ({
    page,
  }) => {
    await page.goto("/");

    // These are THE tiles a learner taps, in Arabic, under a thumb — the
    // `.tile`/`.tile-hit` pair edge case #82 prescribes. The Arabic is inside a
    // `<bdi lang="ar">` (FaceText's default element, for bidi isolation that
    // survives a stylesheet failure), NOT on the button — so a selector of
    // `button[lang="ar"]` finds nothing. It is asserted from the button.
    // The demo FETCHES the staged corpus before it can render a tile, so the
    // bank does not exist at load. Waiting for the first tile (rather than for
    // a timeout) is what makes this deterministic on a slow machine.
    const tiles = page.locator("button.tile");
    await expect(tiles.first(), "the demo renders Arabic option tiles").toBeVisible();
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const tile = tiles.nth(i);

      // The bidi isolation the sacred text depends on (#80): a missing dir
      // renders the ayah in the wrong order rather than failing loudly.
      const bdi = tile.locator('bdi[lang="ar"]');
      await expect(bdi, `tile ${i} isolates its Arabic in a bdi`).toHaveCount(1);
      await expect(bdi).toHaveAttribute("dir", "rtl");

      // The hit area is the wrapper's, per #82: the locked `.tile` is ~32px
      // and byte-gated, so `.tile-hit` supplies the floor. Measured from the
      // laid-out box — the locked tile is allowed to stay small, but the thing
      // a thumb lands on is not.
      const wrapper = page.locator(".tile-hit").nth(i);
      const box = await wrapper.boundingBox();
      expect(box, `tile ${i}'s .tile-hit wrapper is laid out`).not.toBeNull();
      expect(
        Math.min(box!.width, box!.height),
        `tile ${i} hit area measured ${Math.round(box!.width)}x${Math.round(box!.height)}`,
      ).toBeGreaterThanOrEqual(MIN);
    }
  });

  test("the skip link is reachable and useful by keyboard", async ({ page }) => {
    await page.goto("/progress/list");
    await page.keyboard.press("Tab");

    const skip = page.locator(".skip-link");
    await expect(skip, "the first tab stop is the skip link").toBeFocused();

    // It must point at something that exists, or it is decoration.
    const href = await skip.getAttribute("href");
    expect(href).toBe("#main");
    await expect(page.locator("#main")).toHaveCount(1);
  });
});

test.describe("D · /progress/list is a real table, not divs with ARIA", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/progress/list");
    await expect(page.locator("table")).toBeVisible();
  });

  test("native table semantics: caption, thead/tbody, scoped headers", async ({ page }) => {
    // §15's a11y requirement. A screen reader announces "column 3 of 8, Stage"
    // only from REAL table semantics; a grid of divs with role="table" loses
    // most of that in practice.
    const table = page.locator("table");

    await expect(table.locator("caption"), "the table names itself").toHaveCount(1);
    await expect(table.locator("thead")).toHaveCount(1);
    await expect(table.locator("tbody")).toHaveCount(1);

    // Every column header is scoped, or column association is guesswork.
    const colHeaders = table.locator("thead th[scope='col']");
    await expect(colHeaders).toHaveCount(8);

    // Every row is headed by its own item — this is what lets a reader say
    // "12:4, Stage, Learning" instead of just "Learning".
    const rowHeaders = table.locator("tbody th[scope='row']");
    const rows = table.locator("tbody tr");
    const rowCount = await rows.count();
    expect(rowCount, "the table has real rows").toBeGreaterThan(0);
    await expect(rowHeaders, "every row carries a scope=row header").toHaveCount(rowCount);
  });

  test("sortable columns announce their state with aria-sort", async ({ page }) => {
    const headers = page.locator("thead th");

    // Exactly one column is the current sort; the rest say "none". Two
    // columns claiming "ascending" is a state a sighted user can see and a
    // screen-reader user cannot.
    const sorts = await headers.evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-sort")),
    );
    expect(sorts.filter((s) => s === "ascending" || s === "descending")).toHaveLength(1);
    expect(sorts.every((s) => s !== null)).toBe(true);

    // And it is live: clicking a different column moves the sort.
    await page.getByRole("button", { name: "Stage" }).click();
    const after = await headers.evaluateAll((els) =>
      els.map((e) => ({
        name: e.textContent?.trim(),
        sort: e.getAttribute("aria-sort"),
      })),
    );
    const active = after.find((h) => h.sort === "ascending" || h.sort === "descending");
    expect(active?.name).toContain("Stage");
  });

  test("every Arabic cell carries dir=rtl and lang=ar", async ({ page }) => {
    // Edge case #80: Arabic inside LTR rows reorders under the bidi algorithm
    // unless it is isolated. A missing `dir` here does not throw — it renders
    // the sacred text in the WRONG ORDER, silently, which is the worst class
    // of defect this product can ship.
    const arabic = page.locator('[lang="ar"]');
    const count = await arabic.count();
    expect(count, "the table renders Arabic").toBeGreaterThan(0);

    const dirs = await arabic.evaluateAll((els) => els.map((e) => e.getAttribute("dir")));
    expect(
      dirs.filter((d) => d !== "rtl"),
      "every lang=ar element also declares dir=rtl",
    ).toEqual([]);
  });

  test("the Arabic actually renders in Amiri, not a tofu fallback", async ({ page }) => {
    // Edge case #84 (Amiri subset tofu). The build gate checks the FILE is
    // present; only a browser can confirm the cascade resolved to it and the
    // glyphs have width.
    const cell = page.locator('[lang="ar"]').first();
    const family = await cell.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family.toLowerCase()).toContain("amiri");

    const box = await cell.boundingBox();
    expect(box!.width, "the Arabic text has rendered width (not zero-width tofu)").toBeGreaterThan(
      0,
    );
  });
});
