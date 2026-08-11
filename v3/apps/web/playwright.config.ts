// PLAYWRIGHT — the M5 e2e suite.
//
// BUILD-PLAN.md M5 Exit criteria, verbatim:
//   "full-Yusuf offline session e2e; airplane-mode drill; Lighthouse >=95 +
//    human VoiceOver/NVDA pass booked"
//
// and the risk register's line 184:
//   "Playwright e2e as a first-class M5 deliverable, not an afterthought."
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SEPARATE RUNNER FROM VITEST
// ---------------------------------------------------------------------------
// `npm test` is the fast unit gate — 700+ assertions in a few seconds, run on
// every edit. A browser suite that boots Chromium and a production Next server
// costs ~30s of fixed overhead before it asserts anything. Folding it into
// `npm test` would make the fast gate slow, and a slow gate is a gate people
// stop running. So: `npm run e2e`, its own script, its own directory.
//
// The e2e files live in `e2e/` and are named `*.test.ts`. Both halves matter:
//
//   - `e2e/` is OUTSIDE vitest's include globs (`lib/**`, `test/**`), so
//     `npm test` does not try to execute Playwright files in a node
//     environment, where `test.describe` does not exist.
//   - `.test.ts` is the suffix `scripts/check-boundaries.mjs` exempts from its
//     clauses. These files legitimately do the things the gate forbids in
//     product code (they open IndexedDB by hand to prove what is in it), and
//     they are test code, so they take the same exemption every other test
//     file takes.
//
// ---------------------------------------------------------------------------
// IT TESTS THE PRODUCTION BUILD, NOT THE DEV SERVER
// ---------------------------------------------------------------------------
// `next dev` and `next build && next start` differ in the ways this suite is
// about: hydration timing, RSC payload shape, and — the load-bearing one —
// prerendering. Edge case #72 (SSR of log-derived values) can only bite in a
// production render. Testing dev would test a program the learner never runs.
//
// `reuseExistingServer` is on locally so an already-running server is reused
// (fast iteration), and off in CI so a stale process can never mask a build
// that no longer starts.

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3311);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",

  // Every file in e2e/ ends in `.test.ts`, INCLUDING the shared driver
  // `idb-helpers.test.ts`, which declares no tests. That suffix is not a
  // stylistic choice: `scripts/check-boundaries.mjs` clause 3 forbids
  // `indexedDB.open` outside `lib/idb/db.ts` and exempts exactly `.test.ts`.
  // The helper MUST open IndexedDB directly — reading the log through
  // `lib/idb` would mean verifying the subject with the subject — so it takes
  // the same exemption every other test file takes, and is excluded from
  // collection here instead.
  testMatch: /.*\.test\.ts$/,
  testIgnore: /idb-helpers\.test\.ts$/,

  // The offline and reload tests mutate IndexedDB for an origin. Playwright
  // gives each test its own browser CONTEXT (and so its own storage), which is
  // what makes them independent — but only if they are not racing for the same
  // Next server's disk. They are not: the server is read-only. Full parallel.
  fullyParallel: true,

  // A `.only` left in a file silently disables every other test in it. In CI
  // that is a green run that asserted almost nothing — exactly the vacuous
  // verification this build has shipped eight of.
  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // The 44px tap-target assertions are about a THUMB, and a thumb is on a
      // phone. Asserting laid-out geometry at a desktop width would measure a
      // layout no learner uses. This project runs the a11y geometry file at a
      // real phone viewport.
      name: "mobile",
      testMatch: /a11y-geometry\.test\.ts$/,
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: {
    // `next start` — the production server. `prebuild` (gates + corpus
    // staging) has already run as part of `npm run build`, so the corpus in
    // public/ is the staged, verified one.
    command: `npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
