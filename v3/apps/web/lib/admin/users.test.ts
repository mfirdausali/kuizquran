/**
 * @vitest-environment jsdom
 */

// `lib/admin/users.ts` — the missing frontend half of
// `Admin\AdminUsersController::exportCsv` (build-plan step 24, M8). The
// backend has been live and fully tested (`AdminPrivacyTest.php`, including
// the M10 finding that the export must be audited BEFORE the stream opens)
// but nothing under `apps/web` ever called it.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { downloadUsersCsv } from "./users";

describe("downloadUsersCsv — failure is a STATE, never an exception", () => {
  const realFetch = globalThis.fetch;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetApiFetchForTests();
    createObjectURL = vi.fn(() => "blob:mock-url");
    revokeObjectURL = vi.fn();
    // jsdom does not implement createObjectURL/revokeObjectURL.
    (URL as unknown as { createObjectURL: typeof createObjectURL }).createObjectURL = createObjectURL;
    (URL as unknown as { revokeObjectURL: typeof revokeObjectURL }).revokeObjectURL = revokeObjectURL;
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("requests /api/admin/users/export.csv through the single egress", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response("pseudonym\nu_abc\n", { status: 200, headers: { "Content-Type": "text/csv" } });
    }) as unknown as typeof fetch;

    await downloadUsersCsv();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/admin/users/export.csv");
  });

  it("a 200 CSV response drives a real anchor-click download and reports `ok`", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("pseudonym\nu_abc\n", { status: 200, headers: { "Content-Type": "text/csv" } }),
    ) as unknown as typeof fetch;

    const outcome = await downloadUsersCsv();
    expect(outcome.ok).toBe(true);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("a non-2xx response is `ok:false` and never touches the download machinery", async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 403 })) as unknown as typeof fetch;

    const outcome = await downloadUsersCsv();
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("403");
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("a network throw becomes `ok:false`, not a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;

    const outcome = await downloadUsersCsv();
    expect(outcome.ok).toBe(false);
  });
});
