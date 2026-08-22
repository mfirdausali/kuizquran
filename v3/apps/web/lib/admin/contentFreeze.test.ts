// `lib/admin/contentFreeze.ts` — the missing frontend half of
// `Admin\ContentFreezeController` (build-plan step 28, M9). The backend
// (`GET /api/admin/content-freeze`) has been live and fully tested
// (`tests/Feature/ContentFreeze/ContentFreezeTest.php`) since M9's freeze gate
// landed, but its own docblock's claim — "the workbench shows them together"
// — was never true: `grep -rln "content-freeze" apps/web` (excluding this
// module, its test, and the unrelated build-script `scripts/content-freeze.mjs`
// naming collision in `lib/corpus/load.ts`) returned nothing. Mirrors
// `lib/admin/health.ts#loadHealth`'s three-state discipline exactly: failure
// is a STATE, never an exception, and the real controller response shape is
// decoded verbatim, never re-derived.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { loadContentFreeze } from "./contentFreeze";

describe("loadContentFreeze — failure is a STATE, never an exception", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("requests /api/admin/content-freeze through the single egress", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(
        JSON.stringify({ surahs: [12, 103, 112], allMet: false, bookable: false, criteria: [], note: "n" }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    await loadContentFreeze();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/admin/content-freeze");
  });

  it("passes a requested surah list as the ?surahs= query param", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(
        JSON.stringify({ surahs: [67], allMet: false, bookable: false, criteria: [], note: "n" }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    await loadContentFreeze([67]);
    expect(seen[0]).toContain("surahs=67");
  });

  it("returns `ready` for the controller's real response shape", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          surahs: [12, 103, 112],
          allMet: false,
          bookable: false,
          criteria: [
            {
              name: "Verification frontier green on every launch surah",
              met: false,
              evidence: ["surah 12: 0/1777 ayat green"],
            },
            { name: "MS gloss drafts do not block the freeze (v3-D15)", met: true, evidence: ["0 gloss draft row(s)"] },
            { name: "hashSpecVersion consistent across ingested rows", met: true, evidence: ["all ingested rows at hashSpecVersion 1"] },
          ],
          note: "Database-side criteria only.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadContentFreeze();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.report.criteria).toHaveLength(3);
      expect(load.report.bookable).toBe(false);
      expect(load.report.criteria[0]!.met).toBe(false);
      expect(load.report.criteria[0]!.evidence).toEqual(["surah 12: 0/1777 ayat green"]);
    }
  });

  /** The load-bearing property from the backend's own test suite: an
   *  all-criteria-met response must decode `bookable`/`allMet` distinctly
   *  from a merely-present criteria array — never inferred client-side. */
  it("a fully-met report decodes bookable and allMet both true", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          surahs: [103],
          allMet: true,
          bookable: true,
          criteria: [{ name: "x", met: true, evidence: [] }],
          note: "n",
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const load = await loadContentFreeze();
    if (load.state !== "ready") throw new Error("expected ready");
    expect(load.report.allMet).toBe(true);
    expect(load.report.bookable).toBe(true);
  });

  it("a network throw becomes `unavailable`, not a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const load = await loadContentFreeze();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("Failed to fetch");
  });

  // A genuine 401 (no auth at all) is intercepted by `apiFetch`'s own
  // learner-identity retry logic before this module ever sees a response —
  // same reason `loadHealth`'s own test suite only exercises 403 here.
  it("a 403 names the reason as an admin-account requirement", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    const load = await loadContentFreeze();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("admin account");
  });

  it("a 200 whose JSON has no `criteria` becomes `unavailable`, never an empty ready", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ surahs: [12], allMet: false, bookable: false, note: "n" }), { status: 200 }),
    ) as unknown as typeof fetch;
    const load = await loadContentFreeze();
    expect(load.state).toBe("unavailable");
  });

  it("a 200 carrying HTML becomes `unavailable`, never a fabricated report", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html></html>", { status: 200 }),
    ) as unknown as typeof fetch;
    const load = await loadContentFreeze();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("not JSON");
  });
});
