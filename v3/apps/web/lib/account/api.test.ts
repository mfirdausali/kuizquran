// THE PDPA CLIENT (build-plan step 23 / M7, LAUNCH-CHECKLIST.md gate 19).
//
// What these tests protect:
//   1. FAILURE IS A STATE, NEVER AN EXCEPTION — every network/parse/shape
//      failure resolves to a typed "unavailable"/"failed" result, matching
//      lib/workbench/verifications.ts and lib/workbench/sign.ts's discipline.
//   2. THE REQUEST BODIES/METHODS ARE EXACTLY WHAT THE SERVER VALIDATES
//      (`AccountController`) — a wrong verb or an extra field here would be
//      invisible to a component test that only checks the RETURN value.
//   3. THE 403/409/404 BRANCHES ARE DISTINCT RESULTS, not folded into one
//      generic failure — a caller needs "already pending" to mean something
//      different from "the server is unreachable".

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAccountExport,
  fetchDeletionStatus,
  requestAccountDeletion,
  restoreAccountDeletion,
} from "./api.ts";

interface Recorded {
  url: string;
  method: string;
  body: unknown;
}

let recorded: Recorded[] = [];
let queue: Array<{ status: number; body: unknown; throwsJson?: boolean } | "network-error"> = [];

beforeEach(() => {
  recorded = [];
  queue = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      recorded.push({
        url,
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      const next = queue.shift() ?? { status: 500, body: {} };
      if (next === "network-error") throw new TypeError("network down");
      if (next.throwsJson) {
        return new Response("not json", { status: next.status });
      }
      return new Response(JSON.stringify(next.body), {
        status: next.status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAccountExport", () => {
  it("hits GET /api/account/export and returns the payload", async () => {
    queue.push({
      status: 200,
      body: {
        exportedAt: "2026-08-12T00:00:00+00:00",
        account: { id: 1, email: null, name: null, isAnonymous: true, createdAt: null, emailVerifiedAt: null },
        events: [{ surah: 12, ayah: 1 }],
        entitlement: null,
        entitlementTransitions: [],
        billingEvents: [],
      },
    });
    const result = await fetchAccountExport();
    expect(result.state).toBe("ready");
    if (result.state !== "ready") throw new Error("unreachable");
    expect(result.data.events).toHaveLength(1);
    expect(recorded).toEqual([{ url: "/api/account/export", method: "GET", body: undefined }]);
  });

  /** v3-D157: `AccountController::export()` gained three fields
   *  (`entitlement`/`entitlementTransitions`/`billingEvents`) beyond
   *  `account`/`events` — this pins that the client surfaces them
   *  unmodified rather than silently narrowing the payload down to the two
   *  fields the old shape check named. */
  it("surfaces entitlement/entitlementTransitions/billingEvents unmodified", async () => {
    queue.push({
      status: 200,
      body: {
        exportedAt: "2026-08-12T00:00:00+00:00",
        account: { id: 1, email: null, name: null, isAnonymous: true, createdAt: null, emailVerifiedAt: null },
        events: [],
        entitlement: { state: "trial", tier: "lifetime" },
        entitlementTransitions: [{ from_state: "trial", to_state: "active", provider_event_id: "evt_1" }],
        billingEvents: [{ provider: "stripe", provider_event_id: "evt_billing_1" }],
      },
    });
    const result = await fetchAccountExport();
    expect(result.state).toBe("ready");
    if (result.state !== "ready") throw new Error("unreachable");
    expect(result.data.entitlement).toEqual({ state: "trial", tier: "lifetime" });
    expect(result.data.entitlementTransitions).toEqual([
      { from_state: "trial", to_state: "active", provider_event_id: "evt_1" },
    ]);
    expect(result.data.billingEvents).toEqual([
      { provider: "stripe", provider_event_id: "evt_billing_1" },
    ]);
  });

  it("a non-2xx becomes a typed failure, never a throw", async () => {
    queue.push({ status: 500, body: {} });
    const result = await fetchAccountExport();
    expect(result).toEqual({ state: "failed", reason: "the API answered 500" });
  });

  it("a network error becomes a typed failure", async () => {
    queue.push("network-error");
    const result = await fetchAccountExport();
    expect(result.state).toBe("failed");
  });

  it("an unparseable body becomes a typed failure", async () => {
    queue.push({ status: 200, body: {}, throwsJson: true });
    const result = await fetchAccountExport();
    expect(result).toEqual({ state: "failed", reason: "the API's answer was not JSON" });
  });

  it("a body missing the export shape is a typed failure, not a fabricated export", async () => {
    queue.push({ status: 200, body: { ok: true } });
    const result = await fetchAccountExport();
    expect(result).toEqual({ state: "failed", reason: "the API's answer carried no export payload" });
  });
});

describe("fetchDeletionStatus", () => {
  it("hits GET /api/account/deletion and reports not-pending", async () => {
    queue.push({ status: 200, body: { pending: false } });
    const result = await fetchDeletionStatus();
    expect(result).toEqual({ state: "ready", status: { pending: false } });
    expect(recorded[0]?.url).toBe("/api/account/deletion");
  });

  it("reports a pending deletion with its dates", async () => {
    queue.push({ status: 200, body: { pending: true, requestedAt: 1, purgeAt: 2 } });
    const result = await fetchDeletionStatus();
    expect(result).toEqual({
      state: "ready",
      status: { pending: true, requestedAt: 1, purgeAt: 2 },
    });
  });

  it("a read failure is 'unavailable', NEVER folded into 'not pending'", async () => {
    queue.push({ status: 500, body: {} });
    const result = await fetchDeletionStatus();
    expect(result.state).toBe("unavailable");
  });
});

describe("requestAccountDeletion", () => {
  it("POSTs /api/account/deletion and returns the restore token", async () => {
    queue.push({ status: 201, body: { ok: true, restoreToken: "tok123", requestedAt: 1, purgeAt: 2 } });
    const result = await requestAccountDeletion();
    expect(result).toEqual({ state: "scheduled", restoreToken: "tok123", requestedAt: 1, purgeAt: 2 });
    expect(recorded).toEqual([{ url: "/api/account/deletion", method: "POST", body: undefined }]);
  });

  it("409 becomes a distinct 'already-pending' result", async () => {
    queue.push({ status: 409, body: { error: "a deletion is already pending" } });
    const result = await requestAccountDeletion();
    expect(result).toEqual({ state: "already-pending" });
  });

  it("403 (admin self-delete) becomes a distinct 'forbidden' result carrying the server's reason", async () => {
    queue.push({ status: 403, body: { error: "admin accounts cannot self-delete" } });
    const result = await requestAccountDeletion();
    expect(result).toEqual({ state: "forbidden", reason: "admin accounts cannot self-delete" });
  });

  it("a scheduled response missing the token is a typed failure — never a fabricated token", async () => {
    queue.push({ status: 201, body: { ok: true } });
    const result = await requestAccountDeletion();
    expect(result).toEqual({ state: "failed", reason: "the API's answer carried no restore token" });
  });
});

describe("restoreAccountDeletion", () => {
  it("POSTs the token as JSON to /api/account/deletion/restore", async () => {
    queue.push({ status: 200, body: { ok: true, restored: true } });
    const result = await restoreAccountDeletion("tok123");
    expect(result).toEqual({ state: "restored" });
    expect(recorded).toEqual([
      {
        url: "/api/account/deletion/restore",
        method: "POST",
        body: { token: "tok123" },
      },
    ]);
  });

  it("404 becomes a distinct 'not-found' result — no token oracle", async () => {
    queue.push({ status: 404, body: { error: "no matching pending deletion" } });
    const result = await restoreAccountDeletion("wrong-token");
    expect(result).toEqual({ state: "not-found" });
  });

  it("a server error becomes a typed failure", async () => {
    queue.push({ status: 500, body: {} });
    const result = await restoreAccountDeletion("tok123");
    expect(result).toEqual({ state: "failed", reason: "the API answered 500" });
  });
});
