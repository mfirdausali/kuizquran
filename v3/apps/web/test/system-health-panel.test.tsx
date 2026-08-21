/**
 * @vitest-environment jsdom
 */

// `SystemHealthPanel` — the missing UI half of `Admin\SystemHealthController`
// (build-plan step 24, "System Health: both checks, coverage alerts, degraded
// banner, rebuild with mutex"). The backend and its 7-test suite
// (`tests/Feature/Admin/SystemHealthTest.php`) have existed since the admin
// console landed; nothing under `apps/web` ever rendered it. Mirrors
// `test/workbench-ui.test.tsx`'s three-state discipline for the exact same
// reason: #167 says a failed probe must render `unknown`, never a fabricated
// 0 or an empty screen that reads as "everything is fine."

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { SystemHealthPanel } from "@/components/admin/SystemHealthPanel";

afterEach(cleanup);

describe("SystemHealthPanel — three states, never two", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("LOADING renders no metric values at all", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<SystemHealthPanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("UNAVAILABLE names the reason and shows no fabricated check rows", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<SystemHealthPanel />);
    await waitFor(() => expect(screen.getByText(/500/)).toBeTruthy());
    expect(screen.queryByText(/fold_determinism_check/)).toBeNull();
  });

  /**
   * EDGE CASE #167, end to end through the real component: an unreported
   * check renders `unknown`, and — the assertion that matters — it is never
   * rendered as, or confused with, a genuine 0.
   */
  it("READY distinguishes a genuine 0 from an unreported unknown", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          checks: [
            { metric: "fold_determinism_check", status: "ok", value: 0, detail: null },
            {
              metric: "selection_determinism_check",
              status: "unknown",
              value: null,
              detail: "no selection_determinism_check result recorded",
            },
          ],
          rebuildRunning: false,
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    render(<SystemHealthPanel />);
    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());

    const rows = screen.getAllByRole("row").slice(1); // drop the header row
    const foldRow = rows.find((r) => r.querySelector("code")?.textContent === "fold_determinism_check");
    const selectionRow = rows.find(
      (r) => r.querySelector("code")?.textContent === "selection_determinism_check",
    );
    const foldCells = foldRow?.querySelectorAll("td") ?? [];
    const selectionCells = selectionRow?.querySelectorAll("td") ?? [];
    expect(foldCells[1]?.textContent).toBe("ok");
    expect(foldCells[2]?.textContent).toBe("0");
    expect(selectionCells[1]?.textContent).toBe("unknown");
    expect(selectionCells[2]?.textContent).toBe("—");
  });

  /** The degraded banner: shown only when a real check is NOT ok. */
  it("shows a degraded banner when any check is unknown or divergent", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          checks: [
            { metric: "fold_determinism_check", status: "divergent", value: 3, detail: null },
            { metric: "selection_determinism_check", status: "ok", value: 0, detail: null },
          ],
          rebuildRunning: false,
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    render(<SystemHealthPanel />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });

  it("shows no degraded banner when every check is ok", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          checks: [
            { metric: "fold_determinism_check", status: "ok", value: 0, detail: null },
            { metric: "selection_determinism_check", status: "ok", value: 0, detail: null },
          ],
          rebuildRunning: false,
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    render(<SystemHealthPanel />);
    await waitFor(() => expect(screen.getByText(/fold_determinism_check/)).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("SystemHealthPanel — the rebuild button, edge case #168", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  function stubHealthThenRebuild(rebuildResponse: Response) {
    let calls = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      const url = String(input);
      if (init?.method === "POST" && url.includes("rebuild-atom-cache")) {
        return rebuildResponse;
      }
      return new Response(
        JSON.stringify({
          checks: [{ metric: "fold_determinism_check", status: "ok", value: 0, detail: null }],
          rebuildRunning: false,
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    return () => calls;
  }

  it("a completed rebuild shows the real counts, not a bare success message", async () => {
    stubHealthThenRebuild(
      new Response(JSON.stringify({ started: true, queued: false, usersProcessed: 5, atomsWritten: 12 }), {
        status: 200,
      }),
    );

    render(<SystemHealthPanel />);
    const button = await screen.findByRole("button", { name: /rebuild/i });
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText(/5/)).toBeTruthy());
    expect(screen.getByText(/12/)).toBeTruthy();
  });

  /**
   * Edge case #130's other half: a dead-lettered learner's existing
   * atom_cache rows are left untouched by AtomCacheRebuilder, but an admin
   * who clicked "rebuild" must still be told a learner was skipped — a bare
   * "rebuild complete" would silently hide a real quarantine.
   */
  it("a completed rebuild with dead letters names the skipped learner count", async () => {
    stubHealthThenRebuild(
      new Response(
        JSON.stringify({
          started: true,
          queued: false,
          usersProcessed: 5,
          atomsWritten: 12,
          deadLetters: [{ userId: 7, error: "unencodable event data" }],
        }),
        { status: 200 },
      ),
    );

    render(<SystemHealthPanel />);
    const button = await screen.findByRole("button", { name: /rebuild/i });
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText(/1 learner\(s\) skipped/i)).toBeTruthy());
  });

  it("a completed rebuild with no dead letters never mentions skipped learners", async () => {
    stubHealthThenRebuild(
      new Response(
        JSON.stringify({ started: true, queued: false, usersProcessed: 5, atomsWritten: 12, deadLetters: [] }),
        { status: 200 },
      ),
    );

    render(<SystemHealthPanel />);
    const button = await screen.findByRole("button", { name: /rebuild/i });
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText(/5/)).toBeTruthy());
    expect(screen.queryByText(/skipped/i)).toBeNull();
  });

  it("a 202-queued response is reported as queued, never as a silent success", async () => {
    stubHealthThenRebuild(
      new Response(
        JSON.stringify({ started: false, queued: true, reason: "a rebuild is already running" }),
        { status: 202 },
      ),
    );

    render(<SystemHealthPanel />);
    const button = await screen.findByRole("button", { name: /rebuild/i });
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText(/already running/i)).toBeTruthy());
  });
});
