// `lib/admin/reveal.ts` — the missing frontend half of
// `Admin\RevealController` (build-plan step 24, M8, WIREFRAME §16). The
// backend has been live and fully tested since it shipped
// (`tests/Feature/Admin/AdminPrivacyTest.php`) but nothing under `apps/web`
// ever called `/api/admin/users/{id}/reveal` or `/api/admin/reveal/{token}`
// — the same "built + tested + zero production callers" shape as
// v3-D100/D124/D125/D126. Mirrors `lib/admin/flags.ts`'s three-state
// discipline and the real controller response shapes exactly.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { checkRevealToken, revealIdentity } from "./reveal";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("revealIdentity — failure is a STATE, never an exception", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts reason_code/reason_text through the single egress", async () => {
    const seen: { url: string; body: unknown }[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
      return jsonResponse({
        pseudonym: "u_abc123",
        identity: { email: "learner@example.com", name: "Test Learner" },
        revealToken: "tok_1",
        expiresAt: 1_700_000_900_000,
      });
    }) as unknown as typeof fetch;

    await revealIdentity(42, { reasonCode: "support_ticket", reasonText: "investigating ticket 4821" });

    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toContain("/api/admin/users/42/reveal");
    expect(seen[0]!.body).toEqual({
      reason_code: "support_ticket",
      reason_text: "investigating ticket 4821",
      acknowledge_pii_warning: false,
    });
  });

  it("a successful reveal returns `revealed` with the identity and token", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        pseudonym: "u_abc123",
        identity: { email: "learner@example.com", name: "Test Learner" },
        revealToken: "tok_1",
        expiresAt: 1_700_000_900_000,
      }),
    ) as unknown as typeof fetch;

    const result = await revealIdentity(42, { reasonCode: "support_ticket", reasonText: "a real reason" });
    expect(result).toEqual({
      state: "revealed",
      pseudonym: "u_abc123",
      email: "learner@example.com",
      name: "Test Learner",
      revealToken: "tok_1",
      expiresAt: 1_700_000_900_000,
    });
  });

  it("edge case #148 — an anonymous subject is `anonymous`, never `not-found`", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ pseudonym: "u_def456", identity: null, reason: "anonymous — no identity held" }),
    ) as unknown as typeof fetch;

    const result = await revealIdentity(7, { reasonCode: "abuse_report", reasonText: "checking a report" });
    expect(result).toEqual({ state: "anonymous", pseudonym: "u_def456" });
  });

  it("a missing account (404) is `not-found`", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ pseudonym: "u_ghi789", identity: null, reason: "no such account" }, 404),
    ) as unknown as typeof fetch;

    const result = await revealIdentity(99999, { reasonCode: "support_ticket", reasonText: "a real reason" });
    expect(result).toEqual({ state: "not-found", pseudonym: "u_ghi789" });
  });

  it("edge case #149 — a PII-shaped reason (422 + detected[]) becomes `pii-warning`", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(
        {
          error: "reason_text appears to contain identifying information",
          detected: ["email-shaped string"],
          hint: "Reference the pseudonym, not the person.",
        },
        422,
      ),
    ) as unknown as typeof fetch;

    const result = await revealIdentity(42, {
      reasonCode: "support_ticket",
      reasonText: "ticket from ahmad.faiz@gmail.com",
    });
    expect(result).toEqual({
      state: "pii-warning",
      detected: ["email-shaped string"],
      hint: "Reference the pseudonym, not the person.",
    });
  });

  it("a plain validation 422 (no `detected`) becomes `rejected`", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: "reason_text must be at least 10 characters" }, 422),
    ) as unknown as typeof fetch;

    const result = await revealIdentity(42, { reasonCode: "support_ticket", reasonText: "short" });
    expect(result).toEqual({ state: "rejected", reason: "reason_text must be at least 10 characters" });
  });

  it("acknowledging the PII warning carries the flag through", async () => {
    const seen: unknown[] = [];
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(init?.body ? JSON.parse(String(init.body)) : null);
      return jsonResponse({
        pseudonym: "u_abc123",
        identity: { email: "learner@example.com", name: null },
        revealToken: "tok_2",
        expiresAt: 1_700_000_900_000,
      });
    }) as unknown as typeof fetch;

    await revealIdentity(42, {
      reasonCode: "support_ticket",
      reasonText: "ticket from ahmad.faiz@gmail.com",
      acknowledgePiiWarning: true,
    });
    expect(seen[0]).toMatchObject({ acknowledge_pii_warning: true });
  });

  it("a network throw becomes `failed`, not a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;

    const result = await revealIdentity(42, { reasonCode: "support_ticket", reasonText: "a real reason" });
    expect(result.state).toBe("failed");
  });
});

describe("checkRevealToken — the refusal is identical for expired, unknown, and not-yours", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("a live token returns `valid` with its expiry", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ valid: true, expiresAt: 1_700_000_900_000 })) as unknown as typeof fetch;

    const result = await checkRevealToken("tok_1");
    expect(result).toEqual({ state: "valid", expiresAt: 1_700_000_900_000 });
  });

  it("a 403 (expired/unknown/not-yours) returns `invalid`, never a distinguishing reason", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ valid: false, reason: "expired or unknown" }, 403)) as unknown as typeof fetch;

    const result = await checkRevealToken("tok_dead");
    expect(result).toEqual({ state: "invalid" });
  });

  it("requests the exact token path through the single egress", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return jsonResponse({ valid: true, expiresAt: 1 });
    }) as unknown as typeof fetch;

    await checkRevealToken("tok_1");
    expect(seen[0]).toContain("/api/admin/reveal/tok_1");
  });
});
