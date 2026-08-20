/**
 * @vitest-environment jsdom
 */

// SessionIsland refreshes the entitlement cache on mount — the LAST unwired
// half of DECISIONS.md v3-D88/v3-D89's recurring finding.
//
// v3-D88 built `GET /api/entitlement` + `lib/entitlement/sync.ts` because
// `permitsIssuance()` had zero callers — but deliberately did NOT wire the
// GATING call (`permitsIssuance(...)` inside `startSession`), because that
// is a genuine, unresolved product question about what "lapsed" means for a
// queue that mixes new material and review in one assembly (v3-D16's
// review-stays-open promise). That question is still open and this change
// does not touch it.
//
// `lib/entitlement/sync.ts`'s own header claims `refreshEntitlementSnapshot`
// "is fire-and-forget from every caller in this codebase (see
// `lib/session/run.ts#startSession`)" — but `run.ts` is a plain state
// machine with NO React and no side-effect scheduling (its own header says
// so), and grepping it for "entitlement" returns nothing. The claim was
// false: nothing anywhere ever called it. This is the opportunistic CACHE
// WARM half — filling the offline-durable snapshot `permitsIssuance` will
// read once a human decides how to wire the gate — not the gating decision
// itself.
//
// TWO PROPERTIES, each with its own assertion:
//   1. IT FIRES. Mounting the real learner surface that starts a session
//      calls GET /api/entitlement at least once.
//   2. IT NEVER BLOCKS (#103, the same rule SyncTrigger's own suite pins).
//      A session starts and reaches "drilling" even when the entitlement
//      fetch fails outright — this is a cache warm, not a precondition.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Corpus, DrillEvent } from "@engine/types.ts";
import { initReconstruct } from "@engine/reconstruct.ts";
import { DEMOTE_OFFER_AFTER_FAILS } from "@engine/gate.ts";

import { DB_NAME, openDb, resetDbForTests, writeLock, getAllEvents, append, RetryableAppendError } from "@/lib/idb";
import { readEntitlementSnapshot } from "@/lib/entitlement/sync";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { resetTokenForTests, setToken } from "@/lib/sync/token";
import { SessionIsland } from "@/components/session/SessionIsland";
import type { SessionRun } from "@/lib/session/run";

// A seam for the Door-1 describe block alone (v3-D98). When null (every
// other test) the REAL `startSession` runs untouched. Overridden there to
// serve a run with exactly ONE queue item — surah 112's own budget already
// fits its whole 4-ayah surah in one sitting (see run.test.ts's own comment
// on why 112 can never naturally leave a Door-1 candidate behind), so a
// component test proving the SUMMARY-SCREEN WIRING needs a deliberately
// short run, not a different surah's budget arithmetic.
let startSessionOverride: (() => Promise<{ ok: true; run: SessionRun }>) | null = null;

vi.mock("@/lib/session/run", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session/run")>();
  return {
    ...actual,
    startSession: (...args: Parameters<typeof actual.startSession>) =>
      startSessionOverride ? startSessionOverride() : actual.startSession(...args),
  };
});

// A seam for edge case #74's retry test alone. When null (every other test)
// the REAL append runs untouched — same discipline as lib/session/run.test.ts's
// own `appendSpy`, which this mirrors so a UI-level test can provoke exactly
// one retryable commit failure without faking a genuine IndexedDB quota error.
let appendSpy:
  | ((ev: Parameters<typeof import("@/lib/idb/append").append>[0],
      ctx: Parameters<typeof import("@/lib/idb/append").append>[1]) => Promise<unknown>)
  | null = null;

vi.mock("@/lib/idb/append", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/idb/append")>();
  return {
    ...actual,
    append: (...args: Parameters<typeof actual.append>) =>
      appendSpy ? appendSpy(...args) : actual.append(...args),
  };
});

afterEach(() => {
  cleanup();
  appendSpy = null;
  startSessionOverride = null;
});

const HERE = dirname(fileURLToPath(import.meta.url));
const SURAH = 112;
const STAGED = resolve(HERE, `../public/corpus/${SURAH}.json`);
const COMPILED = resolve(HERE, `../../../packages/corpus-compiler/output/${SURAH}/corpus.json`);

let corpus: Corpus;

beforeAll(() => {
  const path = existsSync(STAGED) ? STAGED : COMPILED;
  if (!existsSync(path)) {
    throw new Error(
      `No corpus for surah ${SURAH}. Run \`make compile-corpus\` — these tests ` +
        `run against the real corpus on purpose.`,
    );
  }
  corpus = JSON.parse(readFileSync(path, "utf8")) as Corpus;
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

  const m = await import("@/lib/corpus/client");
  m.__resetCorpusCache();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  const m = await import("@/lib/corpus/client");
  m.__resetCorpusCache();
});

interface Call {
  url: string;
}

/** Route the ONE global fetch by path: the corpus asset vs. the entitlement
 *  API — the two things SessionIsland's mount effect now calls. */
function installFetch(entitlementStatus = 200): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = String(url);
      calls.push({ url: path });
      if (path.startsWith("/corpus/")) {
        return { ok: true, json: async () => corpus } as Response;
      }
      if (path.endsWith("/api/entitlement")) {
        if (entitlementStatus !== 200) {
          return new Response("server error", { status: entitlementStatus });
        }
        return new Response(
          JSON.stringify({ state: "trial", tier: "none", region: "INTL", trialSurah: null }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 200 });
    }),
  );
  return calls;
}

describe("mounting the drill warms the entitlement cache (v3-D88's unwired half)", () => {
  it("calls GET /api/entitlement on mount", async () => {
    const calls = installFetch();
    render(<SessionIsland surah={SURAH} />);
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith("/api/entitlement"))).toBe(true),
    );
  });

  it("persists the fetched snapshot to the offline-durable cache", async () => {
    installFetch();
    render(<SessionIsland surah={SURAH} />);
    await waitFor(async () => {
      const snapshot = await readEntitlementSnapshot();
      expect(snapshot).toMatchObject({ state: "trial", tier: "none" });
    });
  });
});

describe("#103 — it never blocks the session (cache warm, not a precondition)", () => {
  it("still reaches the drilling phase when the entitlement fetch fails", async () => {
    installFetch(500);
    render(<SessionIsland surah={SURAH} />);
    await waitFor(() =>
      expect(screen.getByTestId("session-drill")).toBeTruthy(),
    );
    // And the failure left no cache entry — a failed refresh must not
    // fabricate a grant either.
    await expect(readEntitlementSnapshot()).resolves.toBeNull();
  });
});

// v3-D93 — `writeLock.subscribe()` / `useWriterStatus()` (lib/idb/useLogState.ts)
// were built and unit-tested (writeLock.test.ts's "subscribers observe status
// transitions") but had ZERO production callers: SessionIsland took one
// `writeLock.acquire()` snapshot at mount and never learned about a LATER
// promotion. `writeLock.release()`'s own docblock promises "a queued tab is
// promoted without a reload" — that promise was silently broken the entire
// time nothing subscribed. A learner stuck on "This session is open in
// another tab" who closed the other tab had no way back in short of a manual
// reload, even though the underlying Web Locks queue had already promoted
// this tab.
describe("multi-tab writer promotion (v3-D93 — 'promoted without a reload')", () => {
  it("starts the session the moment this tab is promoted from reader to writer, with no remount", async () => {
    installFetch();
    writeLock.resetForTests();
    writeLock.forceForTests({ role: "reader", reason: "another-tab" });
    render(<SessionIsland surah={SURAH} />);

    await waitFor(() =>
      expect(screen.getByText(/open in another tab/i)).toBeTruthy(),
    );
    // No session was assembled while this tab was a reader.
    expect(screen.queryByTestId("session-drill")).toBeNull();

    // The other tab closes; Web Locks grants OUR already-queued request —
    // exactly what `WriteLock.release()` calls "promoted without a reload".
    // `forceForTests` calls the same internal `set()` a real grant would.
    writeLock.forceForTests({ role: "writer" });

    await waitFor(() =>
      expect(screen.getByTestId("session-drill")).toBeTruthy(),
    );
  });

  it("never starts a session while this tab remains a reader", async () => {
    installFetch();
    writeLock.resetForTests();
    writeLock.forceForTests({ role: "reader", reason: "another-tab" });
    render(<SessionIsland surah={SURAH} />);

    await waitFor(() =>
      expect(screen.getByText(/open in another tab/i)).toBeTruthy(),
    );
    // A distractor transition — still not the writer — must not start one.
    writeLock.forceForTests({ role: "reader", reason: "another-tab" });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("session-drill")).toBeNull();
  });
});

// Edge case #74 (QuotaExceeded on a tap write): `lib/idb/append.ts#retryAppend`/
// `RetryableAppendError` were built and tested (append.test.ts) so a failed tap
// is never silently dropped — but nothing in the session loop ever CALLED
// `retryAppend`. `SessionIsland`'s only catch turned every append failure,
// retryable or not, into a bare `<p role="alert">` with no way back: the
// mechanism edge case #74 names ("the card blocks with retry banner") existed
// and was unreachable. A learner who hit a real quota error mid-drill had no
// recovery short of reloading (and reloading a QUOTA-FULL device recovers
// nothing — the same tap fails again on the next attempt too).
describe("edge case #74 — a retryable append failure offers Retry, not a dead end", () => {
  it("clicking Retry lands the SAME tap via retryAppend and returns to drilling — no duplicate event", async () => {
    installFetch();
    render(<SessionIsland surah={SURAH} />);
    await waitFor(() => expect(screen.getByTestId("session-drill")).toBeTruthy());

    const real = await vi.importActual<typeof import("@/lib/idb/append")>(
      "@/lib/idb/append",
    );
    let tapAppendCalls = 0;
    appendSpy = async (ev, actx) => {
      const type = (ev as { type?: string }).type;
      if (type !== "reconstruct_tap" || tapAppendCalls > 0) {
        return real.append(ev, actx);
      }
      tapAppendCalls++;
      throw new RetryableAppendError(
        "write-failed",
        { ...(ev as object), id: "sim-ui-retry-id", deviceId: "sim-ui-retry-device", deviceSeq: 997 } as any,
      );
    };

    const bank = document.querySelector(".bank");
    expect(bank).not.toBeNull();
    const tiles = within(bank as HTMLElement).getAllByRole("button");
    fireEvent.click(tiles[0]!);

    // The dead end this gap left: a bare alert with no way back. The fix is a
    // control the learner can act on, not a paragraph.
    const retryBtn = await screen.findByRole("button", { name: /retry/i });
    expect(screen.queryByTestId("session-drill")).toBeNull();

    fireEvent.click(retryBtn);

    await waitFor(() => expect(screen.getByTestId("session-drill")).toBeTruthy());

    // The retry reused the row `RetryableAppendError` carried — a fresh
    // `answerCurrent` retry (rather than `resume()`) would double-count it
    // under a new id.
    const events = await getAllEvents();
    const taps = events.filter((e) => e.type === "reconstruct_tap");
    expect(taps.length).toBe(1);
    expect(taps[0]!.id).toBe("sim-ui-retry-id");
  });
});

// v3-D98 — FR6 Door 1 ("extra Learn"): `packages/engine/src/freeplay.ts
// #extraLearnGrant` was real, pure, unit-tested three times over and had
// ZERO production callers anywhere in this app — a learner who finished
// today's assembled queue simply saw "Session complete" with no offer of
// one more gate-intact, cost-disclosed ayah. `lib/session/run.ts` gained
// `extraLearnOfferFor`/`startExtraLearn` and `SessionIsland` now calls the
// former on reaching the summary and wires the latter to a button — this
// block proves the COMPONENT actually does that, not just that the two new
// `run.ts` functions are individually correct (already proven, against a
// real 111-ayah surah, in `lib/session/run.test.ts`).
//
// WHY THIS DRIVES REAL TAPS RATHER THAN SEEDING EVENTS DIRECTLY: this file
// has no existing helper that completes a multi-blank ayah through the DOM,
// and this is the SESSION-LOOP equivalent of the e2e suite's own
// `completeFirstRecall` (idb-helpers.test.ts) — trial-and-error per blank,
// because "which tile is correct" is not knowable to this file without
// writing Quranic Arabic as a literal, which v3/CLAUDE.md forbids. Bounded:
// 112:1 has 4 words, so at most 4 blanks × a handful of distractors each.
async function driveOneBlank(): Promise<"advanced" | "stuck"> {
  const bank = document.querySelector(".bank");
  if (!bank) throw new Error("no bank to drive");
  const tiles = within(bank as HTMLElement).getAllByRole("button");
  for (const tile of tiles) {
    fireEvent.click(tile);
    await waitFor(() =>
      expect(
        screen.queryByRole("status") || screen.queryByTestId("session-summary"),
      ).toBeTruthy(),
    );
    if (screen.queryByTestId("session-summary")) return "advanced";
    const status = screen.getByRole("status").textContent ?? "";
    const cont = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(cont);
    if (status.includes("Correct")) return "advanced";
    if (screen.queryByTestId("session-summary")) return "advanced";
    // wrong: the bank reappears identically for the same blank; try the next tile
  }
  return "stuck";
}

async function completeSession(maxBlanks = 20): Promise<void> {
  for (let i = 0; i < maxBlanks; i++) {
    if (screen.queryByTestId("session-summary")) return;
    const result = await driveOneBlank();
    if (result === "stuck") {
      throw new Error(`blank ${i}: every tile in the bank graded wrong`);
    }
    if (screen.queryByTestId("session-summary")) return;
  }
  throw new Error("session did not reach summary within the guard");
}

/** A run whose queue is exactly ONE "learn" item for 112:1 (full production —
 *  the day-1 cold-gate shape, so every word is blanked). Bypasses the normal
 *  budget-fitted assembly (which would learn all 4 of 112's ayat in one
 *  sitting — see run.test.ts's own comment on why) so this test can reach
 *  "session complete" after a SINGLE ayah, leaving ayat 2-4 as real Door-1
 *  candidates the un-mocked `extraLearnOfferFor` will genuinely find. */
function trivialOneItemRun(c: Corpus, now: number): SessionRun {
  return {
    surah: SURAH,
    queue: [{ kind: "learn", atomKey: "112:ayah:1", ayah: 1, estMin: 1 }],
    cursor: 0,
    machine: initReconstruct(c, SURAH, 1, 0, { full: true }),
    startedAt: now,
    slips: 0,
    lastTap: null,
    done: false,
    gateSlipped: false,
    rescaffolding: false,
  };
}

describe("v3-D98 — Door 1 CTA on the real summary screen, actually wired", () => {
  it("offers 'Learn one more ayah', and clicking it resumes drilling on the offered ayah", async () => {
    installFetch();
    const now = Date.now();
    startSessionOverride = () => Promise.resolve({ ok: true, run: trivialOneItemRun(corpus, now) });

    render(<SessionIsland surah={SURAH} />);
    await waitFor(() => expect(screen.getByTestId("session-drill")).toBeTruthy());

    await completeSession();
    await waitFor(() => expect(screen.getByTestId("session-summary")).toBeTruthy());

    // The button only ever renders once the ENGINE grants the offer — this
    // component decides nothing, so the assertion is on the real,
    // independently-derived offer, not a mocked one.
    const cta = await screen.findByRole("button", { name: /learn one more ayah/i });
    expect(cta.textContent).toMatch(/~\d+(\.\d+)? min/);

    fireEvent.click(cta);

    // Back to drilling — on a DIFFERENT ayah (112 only has 4; ayah 1 is
    // already encoded), never a re-offer of the one just finished.
    await waitFor(() => expect(screen.getByTestId("session-drill")).toBeTruthy());
    expect(screen.queryByTestId("session-summary")).toBeNull();

    // Finishing THIS one reaches summary again via the ordinary commit path
    // (invariant #2) — Door 1 is not a parallel, unaudited route to done.
    await completeSession();
    await waitFor(() => expect(screen.getByTestId("session-summary")).toBeTruthy());

    const events = await getAllEvents();
    const produced = events.filter((e) => e.type === "ayah_produced");
    expect(produced.length).toBe(2);
    expect(new Set(produced.map((e) => e.ayah)).size).toBe(2);
  });

  it("never renders the CTA once every candidate ayah is genuinely exhausted", async () => {
    // Seed the log so ONLY ayah 1 remains un-encoded, then let the trivial
    // run finish it — extraLearnOfferFor must find nothing left (surah 112
    // has exactly 4 ayat) and the button must not appear.
    installFetch();
    const now = Date.now();

    const real = await vi.importActual<typeof import("@/lib/session/run")>(
      "@/lib/session/run",
    );
    let seedRun: SessionRun = {
      surah: SURAH,
      queue: [
        { kind: "learn", atomKey: "112:ayah:2", ayah: 2, estMin: 1 },
        { kind: "learn", atomKey: "112:ayah:3", ayah: 3, estMin: 1 },
        { kind: "learn", atomKey: "112:ayah:4", ayah: 4, estMin: 1 },
      ],
      cursor: 0,
      machine: initReconstruct(corpus, SURAH, 2, 0, { full: true }),
      startedAt: now - 1000,
      slips: 0,
      lastTap: null,
      done: false,
      gateSlipped: false,
      rescaffolding: false,
    };
    // Play this seeding run to completion OFF-SCREEN, via the real (unmocked)
    // functions — mirrors run.test.ts's own playThrough, driven by the
    // engine's own correct-index resolution rather than a DOM click.
    const { assemblePass } = await import("@/lib/onboarding/pass");
    for (let guard = 0; guard < 200 && !seedRun.done; guard++) {
      const assembled = assemblePass(seedRun.machine, corpus);
      if (!assembled) break;
      seedRun = await real.answerCurrent(seedRun, corpus, assembled.item.correctIndex, {
        now: now - 1000 + guard,
        tz: "UTC",
      });
    }
    expect(seedRun.done).toBe(true);

    startSessionOverride = () => Promise.resolve({ ok: true, run: trivialOneItemRun(corpus, now) });
    render(<SessionIsland surah={SURAH} />);
    await waitFor(() => expect(screen.getByTestId("session-drill")).toBeTruthy());
    await completeSession();
    await waitFor(() => expect(screen.getByTestId("session-summary")).toBeTruthy());

    // Give the offer effect a tick to resolve, then assert the CTA never appears.
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("button", { name: /learn one more ayah/i })).toBeNull();
  });
});

// v3-D106 — FR6 Door 2 ("weak-spot gym"): `packages/engine/src/freeplay.ts
// #weakSpots` was real, pure, unit-tested since it landed alongside Door 1
// and had ZERO production callers — v3-D98's own header named it out of
// scope pending "a real UI surface of its own (a ranked list)." `lib/session/
// run.ts` gained `weakSpotOfferFor`/`startWeakSpotDrill` and `SessionIsland`
// now calls the former on reaching the summary and wires the latter to a
// button — this block proves the COMPONENT actually does that, mirroring the
// Door 1 CTA block above exactly (already proven at the `run.ts` level, on a
// real 111-ayah surah, in `lib/session/run.test.ts`).
describe("v3-D106 — Door 2 CTA on the real summary screen, actually wired", () => {
  it("offers 'Practice your weakest spot', and clicking it resumes drilling that ayah as a REVIEW", async () => {
    installFetch();
    const now = Date.now();
    // `trivialOneItemRun` forces `full:true` — the day-1 cold-gate shape —
    // so completing it encodes 112:1, which is exactly what makes it a
    // weak-spot CANDIDATE at all: `weakSpots` only ranks ENCODED atoms.
    startSessionOverride = () => Promise.resolve({ ok: true, run: trivialOneItemRun(corpus, now) });

    render(<SessionIsland surah={SURAH} />);
    await waitFor(() => expect(screen.getByTestId("session-drill")).toBeTruthy());

    await completeSession();
    await waitFor(() => expect(screen.getByTestId("session-summary")).toBeTruthy());

    // The button only ever renders once the ENGINE ranks the offer — this
    // component decides nothing, so the assertion is on the real,
    // independently-derived offer, not a mocked one.
    const cta = await screen.findByRole("button", { name: /practice your weakest spot/i });
    expect(cta.textContent).toMatch(/ayah 1/);

    fireEvent.click(cta);

    // Back to drilling — the SAME ayah, this time as a review rep, never a
    // parallel unaudited route (invariant #2: the ordinary commit path).
    await waitFor(() => expect(screen.getByTestId("session-drill")).toBeTruthy());
    expect(screen.queryByTestId("session-summary")).toBeNull();

    await completeSession();
    await waitFor(() => expect(screen.getByTestId("session-summary")).toBeTruthy());

    const events = await getAllEvents();
    const produced = events.filter((e) => e.type === "ayah_produced" && e.ayah === 1);
    // Once from the original Learn, once from the weak-spot review.
    expect(produced.length).toBe(2);
    for (const e of produced) {
      expect(e.structured).toBe(true);
    }
  });

  it("never renders the CTA before any atom is encoded", async () => {
    // `full: false` at strength 0 (the "learn" band) blanks exactly ONE word
    // of the ayah (`blankCountFor`'s own contract in reconstruct.ts), so
    // completing this pass grades S2 — `update()` only sets `encoded: true`
    // on an S3/gate outcome. This reaches the real "summary" phase through
    // the genuine commit path (never a hand-set `done: true` with no queue,
    // which the component cannot actually reach that way — `phase` only
    // becomes "summary" inside `commit()`'s own callback) while leaving
    // nothing for `weakSpots` to rank.
    installFetch();
    const now = Date.now();
    startSessionOverride = () =>
      Promise.resolve({
        ok: true,
        run: {
          surah: SURAH,
          queue: [{ kind: "learn", atomKey: "112:ayah:2", ayah: 2, estMin: 1 }],
          cursor: 0,
          machine: initReconstruct(corpus, SURAH, 2, 0, { full: false }),
          startedAt: now,
          slips: 0,
          lastTap: null,
          done: false,
          gateSlipped: false,
          rescaffolding: false,
        },
      });

    render(<SessionIsland surah={SURAH} />);
    await waitFor(() => expect(screen.getByTestId("session-drill")).toBeTruthy());
    await completeSession();
    await waitFor(() => expect(screen.getByTestId("session-summary")).toBeTruthy());

    // Confirms the precondition: this pass really did grade S2, not S3 — an
    // encoding pass would make this test vacuous (the button SHOULD appear).
    const events = await getAllEvents();
    const produced = events.filter((e) => e.type === "ayah_produced" && e.ayah === 2);
    expect(produced.length).toBe(1);
    expect(produced[0]!.rung).toBe("S2");

    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("button", { name: /practice your weakest spot/i })).toBeNull();
  });
});

// v3-D111 — FR6's diminishing-returns nudge (`packages/engine/src/freeplay.ts
// #diminishingReturns`), the honest line for a learner who keeps massing the
// SAME weak spot in one day: past ~4 same-day reps, invariant #4's ×0.35
// damping means another rep is worth about a third of a spaced one, and the app
// says so rather than letting them grind. `lib/session/run.ts` gained
// `diminishingReturnsNudge` (proven at the run.ts level in
// `lib/session/run.test.ts`); this block proves the COMPONENT renders the
// engine's own string beneath the Door 2 offer, and only once the threshold is
// crossed — the component decides neither the threshold nor the words.
describe("v3-D111 — the diminishing-returns nudge beneath the Door 2 offer", () => {
  async function seedReps(ayah: number, count: number, at: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await append(
        { type: "ayah_produced", ts: at + i, tz: "UTC", surah: SURAH, ayah, rung: "S3", structured: true } as DrillEvent,
        { now: at + i, tz: "UTC" },
      );
    }
  }

  it("renders the honest nudge once the offered weak spot has been massed enough today", async () => {
    installFetch();
    const now = Date.now();
    // Three prior same-day reps of 112:1; the trivial run below completes a
    // fourth, crossing the engine's threshold. Ayah 1 is the ONLY encoded atom,
    // so `weakSpots` ranks it first and Door 2 offers exactly it.
    await seedReps(1, 3, now);
    startSessionOverride = () => Promise.resolve({ ok: true, run: trivialOneItemRun(corpus, now) });

    render(<SessionIsland surah={SURAH} />);
    await waitFor(() => expect(screen.getByTestId("session-drill")).toBeTruthy());
    await completeSession();
    await waitFor(() => expect(screen.getByTestId("session-summary")).toBeTruthy());

    // The offer appears (precondition), and the nudge appears beneath it. The
    // string is the engine's — the assertion is on its content, not a literal
    // the component owns.
    await screen.findByRole("button", { name: /practice your weakest spot/i });
    const nudge = await screen.findByTestId("diminishing-returns-nudge");
    expect(nudge.textContent).toMatch(/spacing/i);
  });

  it("does not render the nudge below the threshold — a couple of reps is not 'a lot'", async () => {
    installFetch();
    const now = Date.now();
    // One prior rep + the trivial run's completion = 2 same-day reps of 112:1,
    // below the engine's floor. The Door 2 offer must still appear (ayah 1 is
    // encoded), proving the nudge's absence is the threshold, not a missing offer.
    await seedReps(1, 1, now);
    startSessionOverride = () => Promise.resolve({ ok: true, run: trivialOneItemRun(corpus, now) });

    render(<SessionIsland surah={SURAH} />);
    await waitFor(() => expect(screen.getByTestId("session-drill")).toBeTruthy());
    await completeSession();
    await waitFor(() => expect(screen.getByTestId("session-summary")).toBeTruthy());

    await screen.findByRole("button", { name: /practice your weakest spot/i });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("diminishing-returns-nudge")).toBeNull();
  });
});

// v3-D107 — the gate forgiveness ladder's demote offer (v2-D08), the learner
// surface for `lib/session/run.ts#demoteOfferFor`/`acceptGateDemote`. Proven
// at the `run.ts` level (a real fold, no DOM) in `lib/session/run.test.ts`;
// this block proves the COMPONENT actually shows and wires it, mirroring the
// Door 1/Door 2 CTA blocks above.
const SEED_T0 = Date.UTC(2026, 7, 11, 9, 0, 0);
const DAY = 86_400_000;

/** A run whose current item is the DUE gate for 112:1, seeded so
 *  `demoteOfferFor` genuinely returns an offer: `DEMOTE_OFFER_AFTER_FAILS`
 *  real `gate_result:false` events already committed to IDB (via `append`,
 *  the same public entry point every real tap uses — never a hand-built
 *  atom), one per learning-day, before this run object is even constructed. */
async function seedDemoteOffer(): Promise<void> {
  await append(
    { type: "ayah_produced", ts: SEED_T0, tz: "UTC", surah: SURAH, ayah: 1, rung: "S3", structured: true } as DrillEvent,
    { now: SEED_T0, tz: "UTC" },
  );
  for (let day = 1; day <= DEMOTE_OFFER_AFTER_FAILS; day++) {
    await append(
      {
        type: "gate_result",
        ts: SEED_T0 + day * DAY,
        tz: "UTC",
        surah: SURAH,
        ayah: 1,
        rung: "S3",
        correct: false,
        structured: true,
      } as DrillEvent,
      { now: SEED_T0 + day * DAY, tz: "UTC" },
    );
  }
}

function gateRunFor(c: Corpus, now: number): SessionRun {
  return {
    surah: SURAH,
    queue: [{ kind: "gate", atomKey: "112:ayah:1", ayah: 1, estMin: 1 }],
    cursor: 0,
    machine: initReconstruct(c, SURAH, 1, 1, { full: true }),
    startedAt: now,
    slips: 0,
    lastTap: null,
    done: false,
    gateSlipped: false,
    rescaffolding: false,
  };
}

describe("v3-D107 — gate forgiveness: the demote offer, actually shown", () => {
  it("shows 'send back to Learn' instead of the quiz card, and accepting it commits gate_demote and resumes the queue", async () => {
    installFetch();
    await seedDemoteOffer();
    const now = Date.now();
    startSessionOverride = () => Promise.resolve({ ok: true, run: gateRunFor(corpus, now) });

    render(<SessionIsland surah={SURAH} />);

    // The demote offer replaces the quiz card entirely — the learner is
    // never shown a cold-gate reconstruction bank for an atom the engine has
    // already decided to offer sending back to Learn.
    const acceptBtn = await screen.findByRole("button", { name: /send.*back to learn/i });
    expect(screen.queryByTestId("session-drill")).toBeNull();

    fireEvent.click(acceptBtn);

    // The only queue item was the gate; accepting the offer resolves it and
    // the (now-empty) queue reaches summary via the ordinary commit path —
    // never a parallel, unaudited route (invariant #2).
    await waitFor(() => expect(screen.getByTestId("session-summary")).toBeTruthy());

    const events = await getAllEvents();
    const demote = events.find((e) => e.type === "gate_demote" && e.ayah === 1);
    expect(demote).toBeDefined();

    const { rebuild } = await import("@engine/rebuild.ts");
    const { atomKey } = await import("@engine/atom.ts");
    const atoms = rebuild(events);
    const atom = atoms.get(atomKey(SURAH, "ayah", 1));
    expect(atom?.encoded).toBe(false);
    expect(atom?.gateFails).toBe(0);
  });

  it("'Try the gate anyway' dismisses the offer and serves the ordinary cold check", async () => {
    installFetch();
    await seedDemoteOffer();
    const now = Date.now();
    startSessionOverride = () => Promise.resolve({ ok: true, run: gateRunFor(corpus, now) });

    render(<SessionIsland surah={SURAH} />);
    const tryBtn = await screen.findByRole("button", { name: /try.*gate anyway/i });
    fireEvent.click(tryBtn);

    await waitFor(() => expect(screen.getByTestId("session-drill")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /send.*back to learn/i })).toBeNull();

    const events = await getAllEvents();
    expect(events.some((e) => e.type === "gate_demote")).toBe(false);
  });

  it("never shows the demote offer before DEMOTE_OFFER_AFTER_FAILS fails — the ordinary gate quiz card renders", async () => {
    installFetch();
    // No seeded fails at all: an atom that is encoded with a gate due, but
    // gateFails still 0.
    await append(
      { type: "ayah_produced", ts: SEED_T0, tz: "UTC", surah: SURAH, ayah: 1, rung: "S3", structured: true } as DrillEvent,
      { now: SEED_T0, tz: "UTC" },
    );
    const now = Date.now();
    startSessionOverride = () => Promise.resolve({ ok: true, run: gateRunFor(corpus, now) });

    render(<SessionIsland surah={SURAH} />);
    await waitFor(() => expect(screen.getByTestId("session-drill")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /send.*back to learn/i })).toBeNull();
  });
});

// v3-D108 — FR9's 2-minute floor session, the mode this route now supports
// alongside the ordinary daily assembly (`?mode=floor`). This proves the
// COMPONENT-LEVEL wiring — that passing `mode="floor"` actually calls
// `startFloorSession` rather than the ordinary `startSession` — through the
// REAL `lib/session/run.ts` (no mock override here: the seam above is
// `startSession`-only, on purpose, so this block exercises the genuine
// function).
describe("v3-D108 — SessionIsland mode='floor' drills FR9's floor session, not the ordinary assembly", () => {
  it("shows the floor-specific unavailable message on a virgin log — nothing has ever been encoded to check in on", async () => {
    installFetch();
    render(<SessionIsland surah={SURAH} mode="floor" />);
    await waitFor(() =>
      expect(screen.getByText(/nothing to check in on yet/i)).toBeTruthy(),
    );
    expect(screen.queryByTestId("session-drill")).toBeNull();
  });

  it("drills a real floor session once something is encoded — the same graded path, a smaller queue", async () => {
    installFetch();
    const seedT0 = Date.now() - 3 * 24 * 60 * 60 * 1000;
    await append(
      { type: "ayah_produced", ts: seedT0, tz: "UTC", surah: SURAH, ayah: 1, rung: "S3", structured: true } as DrillEvent,
      { now: seedT0, tz: "UTC" },
    );

    render(<SessionIsland surah={SURAH} mode="floor" />);
    await waitFor(() => expect(screen.getByTestId("session-drill")).toBeTruthy());
  });
});
