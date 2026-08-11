/**
 * @vitest-environment jsdom
 */

// THE DASHBOARD'S DUE COUNT — /home's TODAY card (WIREFRAME §1 / §12,
// edge cases #72 and #73).
//
// ---------------------------------------------------------------------------
// WHAT THESE TESTS REFUSE TO DO
// ---------------------------------------------------------------------------
// The tempting test is `expect(screen.getByText(/4 items due/))` against a log
// the test hand-built to produce four. That test is TRUE and constrains almost
// nothing: it pins a number the test itself chose, so an implementation that
// counted the wrong thing — atoms instead of queue items, say — would keep it
// green as long as both happened to be four.
//
// So the central assertion here does not name a number at all. It runs the
// ENGINE's own `assembleQueue` over the same event log the component reads, and
// asserts the digit on screen is that queue's length. The expectation is
// derived from the scheduler, which means the test fails the moment the
// dashboard's number stops being the session's number — which is the ONLY
// property worth pinning here. §10: the numbers shown must be the numbers the
// scheduler uses.
//
// `assembleQueue` is imported HERE and nowhere under `app/` or `components/`:
// clause 5 exempts test files precisely so an assertion may reach for the
// engine's answer while a view may not.
//
// ---------------------------------------------------------------------------
// NO ARABIC. NOT ONE BYTE.
// ---------------------------------------------------------------------------
// The corpus is the REAL staged asset, read from disk and served through a
// stubbed `fetch` — the same bytes the browser gets. Nothing here types a
// glyph; the assertions are about counts, sentences and coordinates.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Corpus, DrillEvent } from "@engine/types.ts";
import { rebuild } from "@engine/rebuild.ts";
import { assembleQueue } from "@engine/scheduler.ts";

import { DB_NAME, append, currentTz, openDb, resetDbForTests, writeLock } from "@/lib/idb";
import { getEventsForSurah } from "@/lib/idb/read";
import { commitOnboarding } from "@/lib/onboarding/choices";
import { ONBOARDING_HREF } from "@/lib/onboarding/surahs";
import { TodaySession } from "@/components/home/TodaySession";

afterEach(cleanup);

const HERE = dirname(fileURLToPath(import.meta.url));
const SURAH = 112;
const STAGED = resolve(HERE, `../public/corpus/${SURAH}.json`);
const COMPILED = resolve(
  HERE,
  `../../../packages/corpus-compiler/output/${SURAH}/corpus.json`,
);

let corpus: Corpus;

beforeAll(() => {
  // The staged asset is what the browser actually fetches. Prefer it, and fall
  // back to the compiler's output so a checkout that compiled but did not stage
  // still runs these rather than skipping them silently.
  const path = existsSync(STAGED) ? STAGED : COMPILED;
  if (!existsSync(path)) {
    throw new Error(
      `No corpus for surah ${SURAH}. Run \`make compile-corpus\` — these tests ` +
        `run against the real corpus on purpose, and a fixture would keep them ` +
        `green after the real one drifted.`,
    );
  }
  corpus = JSON.parse(readFileSync(path, "utf8")) as Corpus;
});

beforeEach(async () => {
  // Same teardown as test/dashboard.test.tsx, and for the same reason found the
  // hard way there: `resetDbForTests` drops the MEMOIZED CONNECTION, not the
  // data, and `deleteDatabase` blocks forever on a live handle.
  try {
    const db = await openDb();
    db.close();
  } catch {
    // No database yet on the first test.
  }
  resetDbForTests();
  await new Promise<void>((done) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => done();
    req.onerror = () => done();
    req.onblocked = () => done();
  });
  writeLock.resetForTests();
  writeLock.forceForTests({ role: "writer" });

  // The client corpus loader memoises per module instance; one test's corpus
  // would otherwise satisfy the next test's "no corpus" assertion.
  const m = await import("@/lib/corpus/client");
  m.__resetCorpusCache();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  const m = await import("@/lib/corpus/client");
  m.__resetCorpusCache();
});

/** Serve the REAL staged corpus bytes over a stubbed fetch. */
function serveCorpus(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => corpus })),
  );
}

/** Serve NOTHING — the offline / unstaged case (#91). */
function serveNoCorpus(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, json: async () => ({}) })),
  );
}

/** Enroll this device, the way onboarding does — through the real committer,
 *  not by poking meta rows, so the read path under test is the real one. */
async function enroll(surah: number): Promise<void> {
  await commitOnboarding(
    { glossLang: "en", surah, pace: "steady", placement: { kind: "fresh" } },
    Date.now(),
  );
}

/** Append a real graded event through the real ingestion path. */
async function addEvent(ev: Partial<DrillEvent> & { ts: number }): Promise<void> {
  await append(ev as DrillEvent, { now: ev.ts, tz: currentTz() });
}

/**
 * THE ORACLE — the engine's own answer for the queue, computed from the SAME
 * event log the component reads.
 *
 * This is deliberately a second call to `assembleQueue` rather than a call into
 * `lib/home/queue.ts`: asserting the component agrees with the module it calls
 * would be a tautology. Asserting it agrees with the SCHEDULER is the property.
 */
async function engineDueCount(surah: number, now: number): Promise<number> {
  const prior = await getEventsForSurah(surah);
  const atomsMap = rebuild(prior);
  const wordCounts = new Map<number, number>();
  for (const w of corpus.words) {
    wordCounts.set(w.ayah, (wordCounts.get(w.ayah) ?? 0) + 1);
  }
  const lastActiveDay =
    prior.length > 0 ? prior.reduce((max, e) => (e.ts > max ? e.ts : max), 0) : null;
  const seen = new Set<number>();
  for (const a of atomsMap.values()) if (a.kind === "ayah") seen.add(a.ref);
  const learnCandidates = [...new Set(corpus.words.map((w) => w.ayah))]
    .sort((x, y) => x - y)
    .filter((n) => !seen.has(n));

  return assembleQueue({
    surah,
    atoms: [...atomsMap.values()],
    now,
    lastActiveDay,
    wordCounts,
    cfg: { learnCandidates },
  }).length;
}

// ---------------------------------------------------------------------------
// THE ONE THAT MATTERS — the number on screen IS the scheduler's number
// ---------------------------------------------------------------------------
describe("§10 — the due count shown is the due count the session will serve", () => {
  it("renders the ENGINE's queue length for a device with no history", async () => {
    await enroll(SURAH);
    serveCorpus();

    const expected = await engineDueCount(SURAH, Date.now());
    // A guard on the ORACLE itself: an oracle that returned 0 here would make
    // the assertion below vacuously satisfiable by a component that renders
    // nothing. A freshly-enrolled learner has work waiting.
    expect(expected).toBeGreaterThan(0);

    render(<TodaySession />);
    await waitFor(() =>
      expect(screen.getByTestId("today-session")).toBeTruthy(),
    );
    expect(
      screen.getByText(new RegExp(`\\b${expected} items? due today`, "i")),
    ).toBeTruthy();
  });

  it("still matches the engine after a real drill has moved the fold", async () => {
    await enroll(SURAH);
    serveCorpus();

    // Real events through the real append path — an encoded ayah changes what
    // the scheduler assembles, so a component that ignored the log entirely
    // (and always printed the same number) fails here even though it passed the
    // test above.
    const t = Date.now() - 3 * 24 * 60 * 60 * 1000;
    await addEvent({ type: "ayah_produced", ts: t, surah: SURAH, ayah: 1, rung: "S3" });
    await addEvent({
      type: "ayah_produced",
      ts: t + 1000,
      surah: SURAH,
      ayah: 2,
      rung: "S3",
    });

    const expected = await engineDueCount(SURAH, Date.now());
    expect(expected).toBeGreaterThan(0);

    render(<TodaySession />);
    await waitFor(() =>
      expect(screen.getByTestId("today-session")).toBeTruthy(),
    );
    expect(
      screen.getByText(new RegExp(`\\b${expected} items? due today`, "i")),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// #73 — a skeleton is never a zero
// ---------------------------------------------------------------------------
describe("#73 — no number is painted before the schedule is known", () => {
  it("paints a skeleton with NO DIGIT on the first frame", async () => {
    await enroll(SURAH);
    serveCorpus();

    const { container } = render(<TodaySession />);
    // The first paint. "Nothing due today" here — to a learner who has four
    // items waiting — is the exact retention-honesty violation the boundary
    // exists for, so the absence of any digit is asserted directly.
    expect(container.querySelector(".skel")).toBeTruthy();
    expect(container.textContent).not.toMatch(/\d/);
    // And it must not have already claimed the day is finished.
    expect(container.textContent).not.toMatch(/nothing due/i);
  });
});

// ---------------------------------------------------------------------------
// §12 — no CTA into a session that does not exist
// ---------------------------------------------------------------------------
describe("§12 — the CTA appears only when there is something to start", () => {
  it("offers the session route when the queue is non-empty", async () => {
    await enroll(SURAH);
    serveCorpus();

    render(<TodaySession />);
    const cta = await screen.findByRole("link", { name: /start today's session/i });
    expect(cta.getAttribute("href")).toBe("/session");
  });

  it("offers NO route into a session when nothing is due", async () => {
    await enroll(SURAH);
    serveCorpus();

    // Drive the queue to empty by carrying the whole surah: every ayah encoded
    // at full strength, minutes ago, so nothing has decayed and no gate is due.
    const now = Date.now();
    const ayat = [...new Set(corpus.words.map((w) => w.ayah))];
    let seq = 0;
    for (const ayah of ayat) {
      for (let rep = 0; rep < 3; rep++) {
        await addEvent({
          type: "ayah_produced",
          ts: now - 60_000 + seq++,
          surah: SURAH,
          ayah,
          rung: "S3",
        });
      }
    }

    // The oracle decides whether this test is meaningful. If the engine still
    // has work here, the setup did not reach the state being tested and the
    // test must say so rather than assert an absence that was never at risk.
    const expected = await engineDueCount(SURAH, now);
    expect(expected).toBe(0);

    render(<TodaySession />);
    await waitFor(() => expect(screen.getByText(/nothing due today/i)).toBeTruthy());
    expect(screen.queryByRole("link", { name: /start today's session/i })).toBeNull();
    // And it says the day is FINISHED rather than implying something broke.
    expect(screen.getByText(/up to date/i)).toBeTruthy();
  });

  it("offers NO CTA and sends an un-enrolled device to onboarding", async () => {
    serveCorpus();
    // No `enroll()` — this device never onboarded.
    render(<TodaySession />);
    await waitFor(() =>
      expect(screen.getByText(/haven't started a surah yet/i)).toBeTruthy(),
    );
    expect(screen.queryByRole("link", { name: /start today's session/i })).toBeNull();
    // The link must point at a route that EXISTS. `/onboarding` is not one —
    // the `(onboarding)` group contributes no URL segment.
    const link = screen.getByRole("link", { name: /choose one/i });
    expect(link.getAttribute("href")).toBe(ONBOARDING_HREF);
    expect(link.getAttribute("href")).toBe("/start");
  });
});

// ---------------------------------------------------------------------------
// THE DASHBOARD IS READ-ONLY
// ---------------------------------------------------------------------------
// `startSession` APPENDS a `session_start`, and that event is the origin every
// session summary is measured from. A dashboard that called it — the obvious
// way to get a queue, and the one the plan explicitly warned against — would
// fabricate a session the learner never opened and shift that window every time
// they glanced at /home.
//
// It is asserted on the LOG rather than by spying on `append`, because the log
// is the thing that would actually be corrupted.
describe("rendering the dashboard writes nothing to the log", () => {
  it("appends no event — in particular no session_start", async () => {
    await enroll(SURAH);
    serveCorpus();

    const before = await getEventsForSurah(SURAH);

    render(<TodaySession />);
    await waitFor(() => expect(screen.getByTestId("today-session")).toBeTruthy());

    const after = await getEventsForSurah(SURAH);
    expect(after.length).toBe(before.length);
    expect(after.some((e) => e.type === "session_start")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// A MISSING CORPUS IS NOT A FINISHED DAY
// ---------------------------------------------------------------------------
describe("an unavailable corpus gets its own words", () => {
  it("never reports 'nothing due' when the corpus could not be loaded", async () => {
    await enroll(SURAH);
    serveNoCorpus();

    render(<TodaySession />);
    await waitFor(() =>
      expect(screen.getByText(/not available on this device yet/i)).toBeTruthy(),
    );
    // The failure this prevents: a learner is told their work is done when in
    // fact the app cannot see it. Two different situations, two different
    // sentences, and no CTA into a session that cannot be assembled.
    expect(screen.queryByText(/nothing due today/i)).toBeNull();
    expect(screen.queryByText(/up to date/i)).toBeNull();
    expect(screen.queryByRole("link", { name: /start today's session/i })).toBeNull();
  });
});
