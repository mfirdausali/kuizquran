// Commit 2 of 2 of the two-device determinism e2e (BUILD-PLAN M6's own exit
// criterion: "two-device determinism e2e"). Commit 1
// (api-cors-smoke.test.ts, DECISIONS.md v3-D378) landed the infrastructure —
// CORS + a second disposable `v3/api` `webServer` entry — deliberately
// scoped away from the actual scenario, per DECISIONS.md v3-D366/D367/D369/
// D371 through D378 each naming it genuinely unswept. This is that scenario.
//
// WHAT THIS PROVES THAT NOTHING ELSE DOES:
//
//   - `apps/web/lib/sync/merge.test.ts` proves the CLIENT's merge is
//     order-insensitive — against a hand-fed array, inside one process,
//     never touching a network or a real Laravel instance.
//   - `v3/api/tests/Feature/Events/EventsPullTest.php` proves the SERVER's
//     ingest+pull contract — against Laravel's own in-process
//     `RefreshDatabase` testing harness (`$this->postJson(...)`), which
//     never opens a real socket and uses `Sanctum::actingAs()` or a
//     hand-minted token from the SAME process, never a real two-request
//     register-then-login flow.
//
// Neither exercises a real SECOND DEVICE: a genuinely separate bearer token,
// minted by a genuinely separate `POST /auth/login` request, against a
// REAL running server process (`scripts/e2e-serve.sh`, over real sockets),
// whose answer is then folded by the real engine and cross-checked against
// an oracle computed independently of the server entirely. That is what
// this file adds, and it is the actual thing BUILD-PLAN M6 asks for.
//
// Uses Playwright's `request` fixture only (a direct HTTP client), not a
// browser `page` — deliberately: the question here is whether the WIRE and
// the SERVER preserve determinism, not whether the UI can drive it, and a
// browser page would need `NEXT_PUBLIC_API_BASE` baked into the Next app's
// OWN production build at build time (apiFetch.ts's `apiBase()`), which
// would change same-origin `/api/*` behavior for every OTHER e2e test that
// shares that same build. Reaching the disposable `v3/api` server directly
// avoids that blast radius entirely while still proving the real thing.
//
// NO ARABIC LITERALS — events reference fixture coordinates only (surah +
// ayah numbers), same discipline as merge.test.ts's own fixture.

import crypto from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import type { DrillEvent } from "../../../packages/engine/src/types.ts";
import { rebuild, type AtomsMap } from "../../../packages/engine/src/rebuild.ts";
import { canonicalOrder } from "../../../worker/fold-runner/src/canonicalOrder.ts";
import { compareAtomCaches } from "../../../worker/fold-runner/src/determinism.ts";
import { E2E_API_BASE_URL } from "./apiServer.ts";

/** A graded event at fixture coordinates — mirrors
 *  `apps/web/lib/sync/merge.test.ts#ev()` exactly (surah 67, not 12, so a
 *  grep over this file never collides with that one's fixture ids). */
function ev(over: Partial<DrillEvent> & { id: string; ts: number }): DrillEvent {
  return {
    type: "rung_complete",
    surah: 67,
    ayah: 1,
    rung: "S1",
    ...over,
  };
}

/**
 * The adversarial two-device fixture, same three load-bearing properties as
 * `merge.test.ts#twoDeviceFixture()` (ts collisions ACROSS devices;
 * deviceSeq CONTRADICTING ts order within a device; OVERLAPPING deviceSeq
 * ranges across devices, edge case #49's cold-second-device shape) — an
 * all-correct, non-colliding fixture would pass even if the server silently
 * dropped `deviceSeq` or `deviceId` on ingest, the exact "assertion that
 * cannot fail" trap that file's own header warns against.
 */
function twoDeviceFixture(): DrillEvent[] {
  const A = "e2e-dev-a";
  const B = "e2e-dev-b";
  return [
    // ts COLLISION across devices at t=1000; only (deviceId, deviceSeq) can
    // order these three.
    ev({ id: "a-1", ts: 1000, deviceId: A, deviceSeq: 5000, ayah: 1, rung: "S1" }),
    ev({ id: "b-1", ts: 1000, deviceId: B, deviceSeq: 1, ayah: 1, rung: "S2" }),
    ev({ id: "a-2", ts: 1000, deviceId: A, deviceSeq: 5001, ayah: 1, rung: "S2" }),

    // OVERLAPPING deviceSeq ranges (A at 5002+, B at 2) AND a ts collision —
    // a merge that reordered the canonical tuple to (ts, deviceSeq, ...)
    // would put b-2 before a-3, visibly wrong.
    ev({ id: "a-3", ts: 2000, deviceId: A, deviceSeq: 5002, ayah: 2, rung: "S1" }),
    ev({ id: "b-2", ts: 2000, deviceId: B, deviceSeq: 2, ayah: 2, rung: "S2" }),

    // deviceSeq CONTRADICTS ts order within device A: a-5 (seq 5004) has an
    // EARLIER ts than a-retry (seq 5003), inverting what ts alone would say.
    ev({ id: "a-4", ts: 3000, deviceId: A, deviceSeq: 5004, ayah: 3, rung: "S1" }),
    ev({ id: "a-retry", ts: 4000, deviceId: A, deviceSeq: 5003, ayah: 3, rung: "S2" }),

    // A slip interleaved with successes on the SAME ayah, across BOTH
    // devices, at colliding ts — what makes the resulting AtomsMap
    // genuinely order-sensitive rather than merely order-insensitive-by-luck
    // (update.ts branches on the band the atom is in when the error
    // arrives; an all-correct fixture cannot distinguish arrival orders).
    ev({ id: "a-5", ts: 5000, deviceId: A, deviceSeq: 5005, ayah: 4, rung: "S3" }),
    ev({ id: "b-3", ts: 5000, deviceId: B, deviceSeq: 3, ayah: 4, rung: "S3" }),
    ev({ id: "a-6", ts: 5000, deviceId: A, deviceSeq: 5006, ayah: 4, rung: "S3", type: "tap", correct: false }),
    ev({ id: "b-4", ts: 6000, deviceId: B, deviceSeq: 4, ayah: 4, rung: "S2", type: "tap", correct: false }),
    ev({ id: "b-5", ts: 7000, deviceId: B, deviceSeq: 5, ayah: 4, rung: "S3" }),
  ];
}

async function registerDeviceA(
  request: APIRequestContext,
): Promise<{ token: string; email: string; password: string }> {
  const minted = await request.post(`${E2E_API_BASE_URL}/api/auth/anonymous`, {
    headers: { Accept: "application/json" },
    data: {},
  });
  expect(minted.status(), await minted.text()).toBe(201);
  const anonToken = (await minted.json()).token as string;

  const email = `two-device-${crypto.randomUUID()}@example.test`;
  const password = "correct-horse-battery-staple";
  const registered = await request.post(`${E2E_API_BASE_URL}/api/auth/register`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${anonToken}` },
    data: { email, password },
  });
  expect(registered.status(), await registered.text()).toBe(200);
  expect((await registered.json()).isAnonymous).toBe(false);

  return { token: anonToken, email, password };
}

async function loginDeviceB(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const response = await request.post(`${E2E_API_BASE_URL}/api/auth/login`, {
    headers: { Accept: "application/json" },
    data: { email, password },
  });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).token as string;
}

async function pushEvents(
  request: APIRequestContext,
  token: string,
  events: DrillEvent[],
): Promise<{ accepted: number; ignored: number }> {
  const response = await request.post(`${E2E_API_BASE_URL}/api/events`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    data: { events },
  });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

/** Pages through the REAL cursored pull protocol (small `limit`, so this
 *  genuinely exercises `hasMore`/`nextCursor` rather than fetching
 *  everything in one page) and returns every event ingest-ordered. */
async function pullAll(request: APIRequestContext, token: string): Promise<DrillEvent[]> {
  const all: DrillEvent[] = [];
  let since = 0;
  for (;;) {
    const response = await request.get(
      `${E2E_API_BASE_URL}/api/events?since=${since}&limit=3`,
      { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } },
    );
    expect(response.status(), await response.text()).toBe(200);
    const body = await response.json();
    all.push(...(body.events as DrillEvent[]));
    since = body.nextCursor;
    if (!body.hasMore) break;
  }
  return all;
}

test.describe("two-device determinism e2e (BUILD-PLAN M6 exit criterion, commit 2 of 2)", () => {
  test("device A registers, device B logs into the SAME account, and both fold the real server's pull to an identical, oracle-matching AtomsMap", async ({
    request,
  }) => {
    const { token: tokenA, email, password } = await registerDeviceA(request);
    const tokenB = await loginDeviceB(request, email, password);
    expect(tokenB).not.toBe(tokenA);

    const fixture = twoDeviceFixture();
    const fromA = fixture.filter((e) => e.deviceId === "e2e-dev-a");
    const fromB = fixture.filter((e) => e.deviceId === "e2e-dev-b");
    expect(fromA.length + fromB.length).toBe(fixture.length);

    // Each device pushes only ITS OWN events, under ITS OWN token — the
    // real shape of a sync outbox flush, never one device pushing the
    // other's rows.
    const pushedA = await pushEvents(request, tokenA, fromA);
    expect(pushedA).toEqual({ accepted: fromA.length, ignored: 0 });
    const pushedB = await pushEvents(request, tokenB, fromB);
    expect(pushedB).toEqual({ accepted: fromB.length, ignored: 0 });

    // Both devices pull the FULL account log — the real "user_id scoped,
    // not device_id scoped" pull contract (EventsPullTest.php's own
    // `test_pull_is_scoped_to_the_authenticated_user_only`, now exercised
    // with a SECOND device's OWN token rather than a second user).
    const pulledByA = await pullAll(request, tokenA);
    const pulledByB = await pullAll(request, tokenB);
    expect(pulledByA.length).toBe(fixture.length);
    expect(pulledByB.length).toBe(fixture.length);
    // Both devices see byte-identical ingest order regardless of which
    // token asked — the pull is a property of the ACCOUNT, not the device.
    expect(pulledByA.map((e) => e.id)).toEqual(pulledByB.map((e) => e.id));

    // Byte round-trip fidelity: every field this scenario actually depends
    // on survived JSON encode -> HTTP -> SQL storage -> SQL read -> JSON
    // decode, verbatim, for EVERY event, as seen by EITHER device.
    const byId = new Map(fixture.map((e) => [e.id, e]));
    for (const pulled of [pulledByA, pulledByB]) {
      for (const got of pulled) {
        const sent = byId.get(got.id!);
        expect(sent, `unexpected event id in pull: ${got.id}`).toBeDefined();
        expect(got.ts).toBe(sent!.ts);
        expect(got.deviceId).toBe(sent!.deviceId);
        expect(got.deviceSeq).toBe(sent!.deviceSeq);
        expect(got.surah).toBe(sent!.surah);
        expect(got.ayah).toBe(sent!.ayah);
        expect(got.rung).toBe(sent!.rung);
        expect(got.type).toBe(sent!.type);
        if (sent!.correct !== undefined) expect(got.correct).toBe(sent!.correct);
      }
    }

    // THE ORACLE IS INDEPENDENT OF THE SERVER ENTIRELY — the fold of the
    // original in-memory fixture, in the fold-runner's own canonical order,
    // never touching HTTP or SQL. Comparing the two devices' pulls only
    // against EACH OTHER would not be enough (merge.test.ts's own lesson:
    // a bug that damages every view identically survives a
    // self-consistency check) — this is what makes the assertion
    // load-bearing rather than decorative.
    const oracle: AtomsMap = rebuild(canonicalOrder(fixture));
    expect(oracle.size).toBeGreaterThan(0);

    const foldFromA: AtomsMap = rebuild(canonicalOrder(pulledByA));
    const foldFromB: AtomsMap = rebuild(canonicalOrder(pulledByB));

    const vsA = compareAtomCaches(oracle, foldFromA);
    expect(vsA.divergentKeys, "device A's pull diverged from the independent oracle").toEqual([]);
    expect(vsA.matches).toBe(true);

    const vsB = compareAtomCaches(oracle, foldFromB);
    expect(vsB.divergentKeys, "device B's pull diverged from the independent oracle").toEqual([]);
    expect(vsB.matches).toBe(true);

    const aVsB = compareAtomCaches(foldFromA, foldFromB);
    expect(aVsB.divergentKeys, "the two devices disagree with EACH OTHER").toEqual([]);
  });

  test("resending an already-ingested batch from either device is a no-op — idempotency survives a real second HTTP round trip", async ({
    request,
  }) => {
    const { token: tokenA, email, password } = await registerDeviceA(request);
    const tokenB = await loginDeviceB(request, email, password);

    const events = [
      ev({ id: "idem-1", ts: 1000, deviceId: "e2e-dev-a", deviceSeq: 1, ayah: 9, rung: "S1" }),
      ev({ id: "idem-2", ts: 2000, deviceId: "e2e-dev-a", deviceSeq: 2, ayah: 9, rung: "S2" }),
    ];

    const first = await pushEvents(request, tokenA, events);
    expect(first).toEqual({ accepted: 2, ignored: 0 });

    // The SAME uuids, resent from device B's own token (an idempotency key
    // is unique per-user, never per-device — DEFECTS.md#B5's migration
    // comment: "unique PER USER, not globally").
    const resent = await pushEvents(request, tokenB, events);
    expect(resent).toEqual({ accepted: 0, ignored: 2 });

    const pulled = await pullAll(request, tokenA);
    expect(pulled.map((e) => e.id)).toEqual(["idem-1", "idem-2"]);

    const fold = rebuild(canonicalOrder(pulled));
    const oracle = rebuild(canonicalOrder(events));
    expect(compareAtomCaches(oracle, fold).matches).toBe(true);
  });
});
