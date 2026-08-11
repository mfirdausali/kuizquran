// QARI MODE — SIGNING (build-plan step 28 / M9).
//
// The wire shapes here are read off the REAL controller
// (`api/app/Http/Controllers/VerificationsController.php::store`), which
// validates {surah, ayah, tier, reviewerKind, note} and returns
// `{ verification: {...} }` at 201.
//
// WHAT THESE TESTS PROTECT, IN ORDER OF WHAT IT COSTS TO GET WRONG:
//
//  1. THE CLIENT NEVER SENDS A CONTENT HASH. The server ignores one, so a sent
//     hash is inert TODAY — the risk is a future reader believing the field is
//     meaningful and starting to honour it, which reintroduces the TOCTOU hole
//     with a scholar's name on it.
//  2. A SIGNATURE THAT LANDS ON MOVED CONTENT IS REPORTED, NOT SWALLOWED. The
//     row is honest (the server stamps what is current at commit) but the
//     reviewer's CONSENT is not, and the difference is the whole point of the
//     TOCTOU design.
//  3. NO UI CLAIMS SCHOLAR VERIFICATION WITHOUT A HUMAN ROW (v3-D22). This is
//     a religious-authority misrepresentation if it drifts, not a copy bug.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeCertification,
  signAyah,
  type VerificationRow,
} from "@/lib/workbench/sign";

/** Every request the module made, in order, so a test can assert on the BODY
 *  the server would receive — not merely on what the module returned. */
interface Recorded {
  url: string;
  method: string;
  body: unknown;
}

let recorded: Recorded[] = [];

/** Queue of responses, consumed in order: the POST, then the confirming GET. */
let queue: Array<{ status: number; body: unknown }> = [];

beforeEach(() => {
  recorded = [];
  queue = [];
  // `apiFetch` wraps global fetch; stubbing the global exercises the real
  // wrapper (token attach, 401 interceptor) rather than mocking it away.
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

function row(over: Partial<VerificationRow> = {}): VerificationRow {
  return {
    id: 1,
    surah: 12,
    ayah: 4,
    tier: "qari",
    contentHash: "hash-current",
    hashSpecVersion: 1,
    reviewerKind: "human",
    verifiedBy: "qari@example.com",
    note: null,
    createdAt: 1,
    ...over,
  };
}

/** The frontier body the controller emits. */
function frontier(tiers: { qari: string; admin: string }, ayah = 4) {
  return { frontier: { [String(ayah)]: tiers } };
}

describe("signAyah — the request itself", () => {
  it("NEVER sends a content hash", async () => {
    queue = [
      { status: 201, body: { verification: row() } },
      { status: 200, body: frontier({ qari: "verified", admin: "verified" }) },
    ];

    await signAyah({
      surah: 12,
      ayah: 4,
      tier: "qari",
      reviewerKind: "human",
      chipAtRender: "unverified",
    });

    const post = recorded.find((r) => r.method === "POST");
    expect(post).toBeDefined();
    const body = post!.body as Record<string, unknown>;

    // The TOCTOU guarantee, asserted on the WIRE. The server recomputes at
    // commit; a hash sent from here could only ever be a lie about what was
    // reviewed, and the shape must not carry one.
    expect(body).not.toHaveProperty("contentHash");
    expect(body).not.toHaveProperty("content_hash");
    expect(body).not.toHaveProperty("hash");
    // And the fields it MUST carry, including the one with no default.
    expect(body.reviewerKind).toBe("human");
    expect(body.tier).toBe("qari");
  });

  it("sends reviewerKind exactly as chosen — ai is never silently upgraded", async () => {
    queue = [
      { status: 201, body: { verification: row({ reviewerKind: "ai" }) } },
      { status: 200, body: frontier({ qari: "verified", admin: "verified" }) },
    ];

    await signAyah({
      surah: 12,
      ayah: 4,
      tier: "qari",
      reviewerKind: "ai",
      chipAtRender: "unverified",
    });

    const post = recorded.find((r) => r.method === "POST")!;
    expect((post.body as Record<string, unknown>).reviewerKind).toBe("ai");
  });
});

describe("signAyah — the consent re-read", () => {
  it("reports `signed` when the re-read confirms the tier is green", async () => {
    queue = [
      { status: 201, body: { verification: row() } },
      { status: 200, body: frontier({ qari: "verified", admin: "verified" }) },
    ];

    const result = await signAyah({
      surah: 12,
      ayah: 4,
      tier: "qari",
      reviewerKind: "human",
      chipAtRender: "unverified",
    });

    expect(result.state).toBe("signed");
    // The re-read HAPPENED — a "signed" verdict that skipped confirmation
    // would be indistinguishable from this one without asserting the GET.
    expect(recorded.filter((r) => r.method === "GET")).toHaveLength(1);
  });

  it("reports `signed-but-stale` when the content moved between review and commit", async () => {
    // The server stamped the CURRENT hash (correctly). But the frontier says
    // the tier is stale, which can only mean the content is not what the
    // reviewer read. The row stands; the consent does not.
    queue = [
      { status: 201, body: { verification: row() } },
      { status: 200, body: frontier({ qari: "stale", admin: "verified" }) },
    ];

    const result = await signAyah({
      surah: 12,
      ayah: 4,
      tier: "qari",
      reviewerKind: "human",
      chipAtRender: "unverified",
    });

    expect(result.state).toBe("signed-but-stale");
    if (result.state === "signed-but-stale") {
      // The instruction a reviewer needs, not a status code.
      expect(result.reason).toMatch(/re-review/i);
      // The row is still returned — nothing was undone, and pretending
      // otherwise would send someone hunting for a row that exists.
      expect(result.row.id).toBe(1);
    }
  });

  it("treats an unconfirmable signature as stale, never as signed", async () => {
    queue = [
      { status: 201, body: { verification: row() } },
      { status: 503, body: {} },
    ];

    const result = await signAyah({
      surah: 12,
      ayah: 4,
      tier: "qari",
      reviewerKind: "human",
      chipAtRender: "unverified",
    });

    // The safe direction on this screen is always "needs another look".
    expect(result.state).toBe("signed-but-stale");
  });

  it("reports a refused signature as failed and does not re-read", async () => {
    queue = [{ status: 403, body: { error: 'forbidden' } }];

    const result = await signAyah({
      surah: 12,
      ayah: 4,
      tier: "qari",
      reviewerKind: "human",
      chipAtRender: "unverified",
    });

    expect(result.state).toBe("failed");
    if (result.state === "failed") {
      expect(result.reason).toMatch(/not authorised/i);
    }
    expect(recorded.filter((r) => r.method === "GET")).toHaveLength(0);
  });

  it("surfaces the server's own error message for a 422", async () => {
    queue = [
      { status: 422, body: { error: "no ingested hash for this ayah — cannot verify against nothing" } },
    ];

    const result = await signAyah({
      surah: 12,
      ayah: 99,
      tier: "qari",
      reviewerKind: "human",
      chipAtRender: "unverified",
    });

    expect(result.state).toBe("failed");
    if (result.state === "failed") {
      expect(result.reason).toContain("no ingested hash");
    }
  });
});

describe("describeCertification — v3-D22's claim rule", () => {
  it("refuses a scholar claim when every row is AI, however green", () => {
    const claim = describeCertification(
      [row({ reviewerKind: "ai" }), row({ id: 2, reviewerKind: "ai", ayah: 5 })],
      true,
    );

    expect(claim.mayClaimScholarVerification).toBe(false);
    // The sentence must not contain a scholar claim either — the boolean and
    // the copy are produced together precisely so they cannot disagree.
    expect(claim.sentence).not.toMatch(/scholar[- ]verified|certified by/i);
    expect(claim.sentence).toMatch(/no human scholar/i);
    // v3-D22's actual reasoning, kept in front of whoever reads the screen.
    expect(claim.sentence).toMatch(/source/i);
  });

  it("refuses a scholar claim when a human signed but the frontier is not green", () => {
    const claim = describeCertification([row({ reviewerKind: "human" })], false);
    expect(claim.mayClaimScholarVerification).toBe(false);
  });

  it("allows the claim only for a green frontier with a human qari row", () => {
    const claim = describeCertification([row({ reviewerKind: "human" })], true);
    expect(claim.mayClaimScholarVerification).toBe(true);
    expect(claim.sentence).toMatch(/human qari/i);
  });

  it("does not count a human ADMIN-tier row as scholar certification", () => {
    // The admin tier is distractors and specs (v3-D13). Signing it is not
    // certifying the sacred text, and letting it license the claim would mean
    // an operator reviewing foils could make the app claim a qari did.
    const claim = describeCertification([row({ reviewerKind: "human", tier: "admin" })], true);
    expect(claim.mayClaimScholarVerification).toBe(false);
  });
});
