// A SERVER PAGE THAT READS THE CLOCK MUST RENDER AT REQUEST TIME.
//
// ---------------------------------------------------------------------------
// THE DEFECT THIS GUARDS (v3-D301)
// ---------------------------------------------------------------------------
// `app/(app)/plan/page.tsx` resolved `const now = Date.now()` (and the server's
// `tz`) "once on the server so every zone in one render measures from the same
// instant", then handed both to `PlanIsland` as props. Unlike every other
// clock-reading page in this app (`/progress`, `/progress/list`, `/drill`,
// `/surah/[surah]`, `/surah/[surah]/[ayah]` — each reads `params` or
// `searchParams`, a request-time API, so Next renders it per request), `/plan`
// touched nothing request-scoped. Next therefore PRERENDERED it at
// `next build` (`○ /plan` in the route table) and served the build instant
// forever: the live production server answered every request with the same
// `"now":<build ms>` in the RSC payload, `x-nextjs-cache: HIT`,
// `Cache-Control: s-maxage=31536000`.
//
// Found by a live-browser + `next start` click-through, not by any suite:
// `next dev` renders per request (the bug is invisible there), the Playwright
// suite builds seconds before it runs (a frozen `now` is seconds old), and
// every unit test hands `PlanIsland` its own `now`.
//
// In production, days after a deploy, `/plan` would draw its calendar from the
// BUILD day, compute "due today" and decay at the build instant, use the build
// server's zone, and — the worst part — `setDayAway` writes
// `dayIndexOf(now) + offset`, so marking "tomorrow" away would append a
// `day_marked_away` event for a day that is long gone into the append-only log.
//
// ---------------------------------------------------------------------------
// WHAT THIS ASSERTS
// ---------------------------------------------------------------------------
// For every Server Component `page.tsx`/`layout.tsx` under `app/` (anything
// without a `"use client"` directive) whose CODE (comments stripped) reads the
// wall clock: rendering must be request-time, by one of
//   - `await connection()` (next/server) BEFORE the first clock read — the
//     documented Next 16 idiom for exactly this ("prerendering stops here");
//   - reading `searchParams` (a request-time API); or
//   - reading `params` with NO `generateStaticParams` (a dynamic segment that
//     is not prerendered — adding `generateStaticParams` would prerender it and
//     freeze the clock again, so it voids this escape).
// Plus a non-vacuity floor: the scan must actually find the clock-reading
// pages it exists to police, so a broken walker cannot pass by finding none.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");
const APP = join(WEB, "app");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name === "page.tsx" || name === "layout.tsx") out.push(p);
  }
  return out;
}

/** Comments out, so a docblock that merely MENTIONS `Date.now()` neither trips
 *  the scan nor satisfies it. String contents are left alone — none of these
 *  files builds a clock call inside a string. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const CLOCK = /\bDate\.now\(\)|\bnew Date\(\s*\)/;
const CONNECTION = /\bawait\s+connection\(\s*\)/;

interface ServerPage {
  file: string;
  code: string;
}

function serverPages(): ServerPage[] {
  return walk(APP)
    .map((abs) => ({ file: relative(WEB, abs), raw: readFileSync(abs, "utf8") }))
    .filter(({ raw }) => !/^\s*["']use client["']/.test(raw))
    .map(({ file, raw }) => ({ file, code: stripComments(raw) }));
}

function clockReaders(): ServerPage[] {
  return serverPages().filter((p) => CLOCK.test(p.code));
}

/** Why this page renders per request, or null if nothing makes it. */
function requestTimeReason(p: ServerPage): string | null {
  const clockAt = p.code.search(CLOCK);
  const connAt = p.code.search(CONNECTION);
  if (connAt !== -1 && connAt < clockAt) return "await connection() before the clock read";
  if (/\bsearchParams\b/.test(p.code)) return "reads searchParams";
  if (/\bparams\b/.test(p.code) && !/\bgenerateStaticParams\b/.test(p.code)) {
    return "reads params of a non-prerendered dynamic segment";
  }
  return null;
}

describe("a server page that reads the clock renders at request time (v3-D301)", () => {
  it("finds the clock-reading server pages it polices (non-vacuous)", () => {
    const files = clockReaders().map((p) => p.file);
    // The six known today. A floor, not an exact list: a new clock-reading
    // page must not break this test, only be policed by the next one.
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(files).toContain(join("app", "(app)", "plan", "page.tsx"));
  });

  it("no clock-reading server page can be prerendered with a frozen instant", () => {
    const frozen = clockReaders()
      .filter((p) => requestTimeReason(p) === null)
      .map((p) => p.file);
    expect(
      frozen,
      "these Server Components read Date.now()/new Date() but nothing makes them " +
        "render per request, so `next build` prerenders the BUILD instant into them " +
        "forever — call `await connection()` (next/server) before the clock read",
    ).toEqual([]);
  });

  it("/plan opts into request time with await connection() before it reads the clock", () => {
    const plan = clockReaders().find((p) => p.file === join("app", "(app)", "plan", "page.tsx"));
    expect(plan, "plan/page.tsx must still be a clock-reading server page").toBeDefined();
    expect(requestTimeReason(plan!)).toBe("await connection() before the clock read");
    expect(plan!.code).toMatch(/import\s*\{\s*connection\s*\}\s*from\s*["']next\/server["']/);
  });
});
