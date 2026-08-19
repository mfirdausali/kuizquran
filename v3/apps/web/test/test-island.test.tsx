/**
 * @vitest-environment jsdom
 */

// v2 Phase 4 (v2-D13..D16), v3-D103's own named deferral: `TestIsland` is the
// whole-new-route this build's nightly sweep (v3-D82..D103) kept finding
// `packages/engine/src/test.ts` waiting for. This file is the seam-level
// proof — mirrors `lib/session/run.test.ts`'s own header: a component test
// tells you about the component; this drives the SAME assertion that would
// have caught v3-D67 for the session loop — start a Test, answer every item,
// and check the EVENT LOG, not just what painted.
//
// TWO PROPERTIES beyond "it renders": (1) invariant #5 — `test_start`/
// `test_answer`/`test_result` move NO strength, proven by folding the whole
// log afterwards and asserting the atoms map is empty (rebuild.ts has no
// branch for any test_* event, by construction); (2) a "produce" item's
// intra-ayah taps are NEVER logged as `reconstruct_tap` — only the whole
// pass's outcome becomes one `test_answer` (read-only mirror, v2-D14).
//
// NO ARABIC. Every tap below is trial-and-error over whatever the DOM
// actually renders — same technique `session-island.test.tsx`'s own
// `driveOneBlank` uses, for the same reason.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Corpus } from "@engine/types.ts";
import { rebuild } from "@engine/rebuild.ts";

import { DB_NAME, openDb, resetDbForTests, writeLock, getAllEvents } from "@/lib/idb";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { resetTokenForTests, setToken } from "@/lib/sync/token";
import { TestIsland } from "@/components/test/TestIsland";

// `TestIsland` navigates to /progress once a Test's `test_result` lands
// (mirroring v2's own `navigate("/progress")`). No App Router is mounted in
// this jsdom test, so `next/navigation`'s real `useRouter()` throws
// "invariant expected app router to be mounted" — stub it to a spy instead.
const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
}));

const HERE = dirname(fileURLToPath(import.meta.url));

function loadCorpus(surah: number): Corpus {
  const staged = resolve(HERE, `../public/corpus/${surah}.json`);
  const compiled = resolve(HERE, `../../../packages/corpus-compiler/output/${surah}/corpus.json`);
  const path = existsSync(staged) ? staged : compiled;
  if (!existsSync(path)) {
    throw new Error(`No corpus for surah ${surah} at ${staged} or ${compiled}. Run \`make compile-corpus\`.`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as Corpus;
}

let corpus112: Corpus;
let corpus67: Corpus;

beforeAll(() => {
  corpus112 = loadCorpus(112);
  corpus67 = loadCorpus(67);
});

beforeEach(async () => {
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
  resetApiFetchForTests();
  resetTokenForTests();
  setToken("test-token");
  // `lib/corpus/client.ts`'s module-level cache now holds the RESOLVED
  // override effect (corpus + disabled list), not just parsed bytes, so one
  // test's override-free corpus would otherwise leak into the next test's
  // override-carrying one. Same discipline `onboarding.test.tsx` and
  // `home-today.test.tsx` already follow.
  const client = await import("@/lib/corpus/client");
  client.__resetCorpusCache();
});

afterEach(() => {
  cleanup();
});

/** Serves the given corpus for every `/corpus/*.json` request and `{}` for
 *  anything else (`/api/overrides` degrades to no overrides — see
 *  `fetchOverrides`'s own "never throws" contract). */
function installFetch(corpus: Corpus) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("/corpus/")) {
        return { ok: true, json: async () => corpus } as Response;
      }
      return new Response("{}", { status: 200 });
    }),
  );
}

/** Like `installFetch`, but `/api/overrides` answers with real rows so the
 *  `disable` half of the override layer is exercised end to end — the write
 *  path (`POST /api/overrides`, admin-gated, `field: "disable"`) has shipped
 *  since build-plan step 15 and until now reached no learner-facing decision
 *  anywhere. */
function installFetchWithOverrides(corpus: Corpus, overrides: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = String(url);
      if (path.startsWith("/corpus/")) {
        return { ok: true, json: async () => corpus } as Response;
      }
      if (path.includes("/api/overrides")) {
        return new Response(JSON.stringify({ overrides }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    }),
  );
}

async function waitForRunning() {
  return screen.findByTestId("test-running", {}, { timeout: 3000 });
}

/** Drives whichever item is CURRENT to completion (one answer, or — for
 *  "produce" — the whole nested reconstruct pass) and taps "Continue". Every
 *  tap is followed by an explicit Continue in this component (never a timed
 *  auto-advance), so this never needs to wait on a real clock. */
async function answerCurrentItem(): Promise<void> {
  const root = screen.getByTestId("test-running");
  const kind = root.getAttribute("data-item-kind");
  const startIndex = root.getAttribute("data-item-index")!;

  if (kind === "produce") {
    await driveProduceItem(startIndex);
    return;
  }

  const bank = root.querySelector(".bank");
  if (!bank) throw new Error(`no .bank for kind ${kind}`);
  const tiles = within(bank as HTMLElement).getAllByRole("button");
  if (tiles.length === 0) throw new Error(`empty .bank for kind ${kind}`);

  if (kind === "reorder") {
    for (const tile of tiles) fireEvent.click(tile);
  } else {
    fireEvent.click(tiles[0]!);
  }

  const cont = await screen.findByRole("button", { name: /continue/i });
  fireEvent.click(cont);
}

/** Trial-and-error per blank — same technique as `session-island.test.tsx`'s
 *  own `driveOneBlank`, because which tile is correct is not knowable here
 *  without writing Quranic Arabic, which v3/CLAUDE.md forbids. Every tap
 *  (right or wrong) is followed by a Continue in this component, so a wrong
 *  attempt just re-offers the SAME blank with the SAME seeded bank. */
async function driveProduceItem(startIndex: string, guardMax = 200): Promise<void> {
  let attempted = new Set<number>();
  let priorBlank: string | null = null;

  for (let guard = 0; guard < guardMax; guard++) {
    const running = screen.queryByTestId("test-running");
    if (!running || running.getAttribute("data-item-index") !== startIndex) return;

    const ayahEl = running.querySelector(".ayah");
    const currentBlank = ayahEl?.getAttribute("data-blank-index") ?? null;
    if (currentBlank !== priorBlank) {
      attempted = new Set();
      priorBlank = currentBlank;
    }

    const bank = running.querySelector(".bank");
    if (!bank) throw new Error("produce: no bank for the current blank");
    const tiles = within(bank as HTMLElement).getAllByRole("button");
    const tileIndex = tiles.findIndex((_, i) => !attempted.has(i));
    if (tileIndex === -1) {
      throw new Error(`produce: exhausted every tile (${tiles.length}) on blank ${currentBlank}`);
    }

    fireEvent.click(tiles[tileIndex]!);
    const cont = await screen.findByRole("button", { name: /continue/i });
    fireEvent.click(cont);
    attempted.add(tileIndex);
  }
  throw new Error("produce: exceeded the guard without finishing the ayah");
}

async function completeTest(maxItems = 30): Promise<void> {
  for (let i = 0; i < maxItems; i++) {
    if (screen.queryByTestId("test-result")) return;
    await waitFor(() =>
      expect(
        screen.queryByTestId("test-running") || screen.queryByTestId("test-result"),
      ).toBeTruthy(),
    );
    if (screen.queryByTestId("test-result")) return;
    await answerCurrentItem();
  }
  throw new Error("Test did not reach the result phase within the guard");
}

describe("TestIsland — the mixed self-check, end to end", () => {
  it("starts the Test, appends test_start, and lets the range picker default to a sensible span", async () => {
    installFetch(corpus112);
    render(<TestIsland surah={112} glossLang="en" />);

    await screen.findByTestId("test-range");
    const startBtn = screen.getByRole("button", { name: /start test/i });
    fireEvent.click(startBtn);

    await waitForRunning();
    const events = await getAllEvents();
    expect(events.filter((e) => e.type === "test_start").length).toBe(1);
  });

  it(
    "completes a full mixed Test (vocab/cloze/junction/locate + reorder) over surah 112's whole range, " +
      "logs one test_answer per item and one test_result, and moves NO strength",
    async () => {
      installFetch(corpus112);
      render(<TestIsland surah={112} glossLang="en" />);

      await screen.findByTestId("test-range");
      fireEvent.click(screen.getByRole("button", { name: /start test/i }));
      await waitForRunning();

      await completeTest();
      const result = await screen.findByTestId("test-result");
      expect(result.textContent).toMatch(/\d+ \/ \d+ correct/);

      const events = await getAllEvents();
      const answers = events.filter((e) => e.type === "test_answer");
      // 112 has 4 ayat: vocab/cloze/junction/locate (one each) + one reorder
      // item appended over the whole range — 5 items, 5 answers. WHICH ayah
      // lands on which kind is genuinely random (Math.random-backed item
      // SELECTION, by design — test.ts's own header), so a junction slot
      // landing on the range's last ayah legitimately degrades to a SECOND
      // cloze rather than always surviving as "junction" — this assertion
      // pins the closed set and the counts that hold regardless of the draw.
      expect(answers.length).toBe(5);
      const kinds = answers.map((e) => e.testKind);
      for (const k of kinds) {
        expect(["vocab", "cloze", "junction", "locate", "reorder"]).toContain(k);
      }
      expect(kinds.filter((k) => k === "reorder").length).toBe(1);
      expect(kinds.filter((k) => k === "vocab").length).toBe(1);
      expect(kinds.filter((k) => k === "locate").length).toBe(1);
      expect(kinds.filter((k) => k === "cloze" || k === "junction").length).toBe(2);

      fireEvent.click(screen.getByRole("button", { name: /^done$/i }));
      await waitFor(async () => {
        const evs = await getAllEvents();
        expect(evs.filter((e) => e.type === "test_result").length).toBe(1);
      });
      const finalEvents = await getAllEvents();

      // Invariant #5: rebuild.ts has NO fold branch for any test_* event.
      // The atoms map after folding this ENTIRE log — test_start, 5×
      // test_answer, test_result, nothing else was ever appended in this
      // test — must be empty.
      const atoms = rebuild(finalEvents);
      expect(atoms.size).toBe(0);
    },
  );

  it("a produce item never logs a reconstruct_tap — only ONE test_answer for the whole pass", async () => {
    // Surah 67 (30 ayat) so a 5-ayah range reaches KIND_ORDER's 5th slot,
    // "produce" — 112 only has 4 ayat and can never reach it through the
    // ordinary contiguous range the picker builds (see lib/test/build.test.ts's
    // own note on why the reorder item is capped by pool.length, not just the
    // corpus tail — same finite-surah constraint, different item).
    installFetch(corpus67);
    render(<TestIsland surah={67} glossLang="en" />);

    await screen.findByTestId("test-range");
    const fromInput = screen.getByLabelText(/from/i);
    const toInput = screen.getByLabelText(/to/i);
    fireEvent.change(fromInput, { target: { value: "1" } });
    fireEvent.change(toInput, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /start test/i }));
    await waitForRunning();

    await completeTest();
    await screen.findByTestId("test-result");

    const events = await getAllEvents();
    expect(events.filter((e) => e.type === "reconstruct_tap").length).toBe(0);
    const produceAnswers = events.filter((e) => e.type === "test_answer" && e.testKind === "produce");
    expect(produceAnswers.length).toBe(1);

    // Still nothing folds — even the nested reconstruct pass inside a
    // produce item leaves no atom behind.
    expect(rebuild(events).size).toBe(0);
  });

  it("never appends a reorder item, or degrades gracefully, over a single-ayah range", async () => {
    installFetch(corpus112);
    render(<TestIsland surah={112} glossLang="en" />);

    await screen.findByTestId("test-range");
    const fromInput = screen.getByLabelText(/from/i);
    const toInput = screen.getByLabelText(/to/i);
    fireEvent.change(fromInput, { target: { value: "1" } });
    fireEvent.change(toInput, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /start test/i }));
    await waitForRunning();

    await completeTest();
    await screen.findByTestId("test-result");

    const events = await getAllEvents();
    const answers = events.filter((e) => e.type === "test_answer");
    expect(answers.length).toBe(1);
    expect(answers[0]!.testKind).toBe("vocab");
    expect(answers.every((e) => e.ayah === 1 || e.testKind !== "reorder")).toBe(true);
  });

  // The seam-level proof for the disable override. `buildTestItems`' own unit
  // tests prove the FILTER; this proves the WIRING — that a row served by the
  // real `/api/overrides` read path actually reaches the real builder through
  // the real component, which is precisely the step that was missing.
  it("a qari-disabled question kind never surfaces in a real Test", async () => {
    // Ayah-wide (position null) "vocab" disables across every ayah of 112.
    // vocab is KIND_ORDER slot 0, so an unfiltered Test over the full range
    // ALWAYS contains one whatever the shuffle does — the assertion below
    // cannot pass vacuously.
    const overrides = [1, 2, 3, 4].map((ayah, i) => ({
      id: i + 1,
      surah: 112,
      ayah,
      position: null,
      questionType: "vocab",
      field: "disable",
      payload: { disabled: true },
      editorId: null,
      note: null,
      createdAt: i + 1,
    }));
    installFetchWithOverrides(corpus112, overrides);
    render(<TestIsland surah={112} glossLang="en" />);

    await screen.findByTestId("test-range");
    fireEvent.click(screen.getByRole("button", { name: /start test/i }));
    await waitForRunning();

    await completeTest();
    await screen.findByTestId("test-result");

    const events = await getAllEvents();
    const answers = events.filter((e) => e.type === "test_answer");
    expect(answers.length).toBeGreaterThan(0); // the Test still ran
    expect(answers.some((e) => e.testKind === "vocab")).toBe(false);
  });
});
