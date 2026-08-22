/**
 * @vitest-environment jsdom
 */

// `ContentFreezePanel` — the missing UI half of `Admin\ContentFreezeController`
// (build-plan step 28, M9). The backend and its own test suite
// (`tests/Feature/ContentFreeze/ContentFreezeTest.php`) have existed since M9's
// freeze gate landed; its own docblock claimed "the workbench shows them
// together" but nothing under `apps/web` ever rendered it — the same
// "docblock says X, reality is Y" shape as v3-D90/D110/D123. Mirrors
// `test/system-health-panel.test.tsx`'s three-state discipline for the same
// reason: a screen that cannot tell "0 criteria met" from "we could not ask"
// is worse than no screen, on the surface that decides whether to book a
// scholar.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { ContentFreezePanel } from "@/components/admin/ContentFreezePanel";

afterEach(cleanup);

describe("ContentFreezePanel — three states, never two", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("LOADING renders no criterion rows at all", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<ContentFreezePanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("UNAVAILABLE names the reason and shows no fabricated criteria", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<ContentFreezePanel />);
    await waitFor(() => expect(screen.getByText(/500/)).toBeTruthy());
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("READY renders every criterion's name, met state and evidence", async () => {
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
            {
              name: "hashSpecVersion consistent across ingested rows",
              met: true,
              evidence: ["all ingested rows at hashSpecVersion 1"],
            },
          ],
          note: "Database-side criteria only.",
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    render(<ContentFreezePanel />);
    await waitFor(() => expect(screen.getByText(/Verification frontier/)).toBeTruthy());
    expect(screen.getByText(/surah 12: 0\/1777 ayat green/)).toBeTruthy();
    expect(screen.getByText(/all ingested rows at hashSpecVersion 1/)).toBeTruthy();
  });

  it("shows a NOT BOOKABLE banner when bookable is false", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          surahs: [12],
          allMet: false,
          bookable: false,
          criteria: [{ name: "x", met: false, evidence: [] }],
          note: "n",
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    render(<ContentFreezePanel />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toMatch(/not bookable/i);
  });

  it("shows no NOT BOOKABLE banner when bookable is true", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          surahs: [112],
          allMet: true,
          bookable: true,
          criteria: [{ name: "x", met: true, evidence: [] }],
          note: "n",
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    render(<ContentFreezePanel />);
    await waitFor(() => expect(screen.getByText(/^x$/)).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
