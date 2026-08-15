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
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Corpus } from "@engine/types.ts";

import { DB_NAME, openDb, resetDbForTests, writeLock } from "@/lib/idb";
import { readEntitlementSnapshot } from "@/lib/entitlement/sync";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { resetTokenForTests, setToken } from "@/lib/sync/token";
import { SessionIsland } from "@/components/session/SessionIsland";

afterEach(cleanup);

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
