/**
 * @vitest-environment jsdom
 */

// `NightlyWindowPanel` — the missing UI half of `Admin\NightlyWindowController`,
// the 7-consecutive-green-nights window viewer, never built until now.
// Mirrors `test/purge-ledger-panel.test.tsx`'s three-state discipline.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { NightlyWindowPanel } from "@/components/admin/NightlyWindowPanel";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("NightlyWindowPanel — three states, never two", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("LOADING renders no streak at all", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("UNAVAILABLE names the reason and shows no fabricated streak", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);
    await waitFor(() => expect(screen.getByText(/500/)).toBeTruthy());
    expect(screen.queryByText(/of 7/)).toBeNull();
  });

  it("READY with no window declared shows 0 of 7 and the CLI hint, never a bare number", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 0,
        required: 7,
        satisfied: false,
        windowStartedAt: null,
        windowReason: null,
        nights: [],
        lastP1: null,
        blockedBy: "no window start declared — run `nightly:window --start` after the last engine/selection merge",
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/0 of 7/)).toBeTruthy());
    expect(screen.getByText(/NOT DECLARED/)).toBeTruthy();
    expect(screen.getByText(/nightly:window --start/)).toBeTruthy();
  });

  it("READY with a real 7-night streak renders every night's row and the satisfied verdict", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 7,
        required: 7,
        satisfied: true,
        windowStartedAt: "2026-09-01",
        windowReason: "engine merge abc1234",
        nights: [
          {
            night: "2026-09-07",
            green: true,
            severities: { fold_determinism_check: "green", selection_determinism_check: "green" },
            missing: [],
          },
        ],
        lastP1: null,
        blockedBy: null,
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/7 of 7/)).toBeTruthy());
    expect(screen.getByText(/satisfied/)).toBeTruthy();
    expect(screen.getByText("2026-09-07")).toBeTruthy();
    expect(screen.getByText(/fold_determinism_check=green/)).toBeTruthy();
  });

  /**
   * v3-D225: `nights[].triggers` (schedule|manual|ci, per check) is fetched
   * by `lib/admin/nightlyWindow.ts` but was never rendered — an operator
   * had no way to see whether a night's own green verdict came from the
   * real unattended cron or a human's manual re-run. This is the
   * load-bearing case: TWO checks on the SAME night with DIFFERENT
   * triggers both render distinctly, so it cannot pass on one hardcoded
   * label.
   */
  it("each check's own trigger is rendered next to its severity (v3-D225)", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 7,
        required: 7,
        satisfied: true,
        windowStartedAt: "2026-09-01",
        windowReason: "engine merge abc1234",
        nights: [
          {
            night: "2026-09-07",
            green: true,
            severities: { fold_determinism_check: "green", selection_determinism_check: "green" },
            triggers: { fold_determinism_check: "schedule", selection_determinism_check: "manual" },
            missing: [],
          },
        ],
        lastP1: null,
        blockedBy: null,
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/fold_determinism_check=green \(schedule\)/)).toBeTruthy());
    expect(screen.getByText(/selection_determinism_check=green \(manual\)/)).toBeTruthy();
  });

  /** A night with no `triggers` field at all must render exactly as before
   *  this fix — no trigger suffix, never a fabricated "(undefined)". */
  it("a night with no triggers field renders the severity alone, no fabricated suffix", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 7,
        required: 7,
        satisfied: true,
        windowStartedAt: "2026-09-01",
        windowReason: "engine merge abc1234",
        nights: [
          {
            night: "2026-09-07",
            green: true,
            severities: { fold_determinism_check: "green" },
            missing: [],
          },
        ],
        lastP1: null,
        blockedBy: null,
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText("fold_determinism_check=green")).toBeTruthy());
  });

  /** The load-bearing case: a confirmed P1 must be VISIBLE, not just a
   *  lower streak number — an operator needs to see WHY it reset. */
  it("a confirmed P1 is rendered as an explicit alert naming the night and check", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 1,
        required: 7,
        satisfied: false,
        windowStartedAt: "2026-09-01",
        windowReason: "engine merge abc1234",
        nights: [
          { night: "2026-09-04", green: true, severities: { fold_determinism_check: "green" }, missing: [] },
        ],
        lastP1: { night: "2026-09-03", check: "fold_determinism_check" },
        blockedBy: "1 of 7 consecutive green nights",
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/last P1/i)).toBeTruthy());
    expect(screen.getByText(/2026-09-03/)).toBeTruthy();
    expect(screen.getAllByRole("alert").some((el) => /last P1/i.test(el.textContent ?? ""))).toBe(true);
  });

  /**
   * v3-D178: the P1's own per-atom evidence — `nightly_check_runs.report`,
   * fetched and pseudonymized server-side but never rendered — must reach
   * the screen the alert already points an operator at.
   */
  it("a confirmed P1's findings are rendered, pseudonym and atom key both, never the raw learner id", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 1,
        required: 7,
        satisfied: false,
        windowStartedAt: "2026-09-01",
        windowReason: "engine merge abc1234",
        nights: [
          { night: "2026-09-04", green: true, severities: { fold_determinism_check: "green" }, missing: [] },
        ],
        lastP1: { night: "2026-09-03", check: "fold_determinism_check" },
        lastP1Findings: [
          { type: "fold", subjectPseudonym: "u_abc123", key: "12:ayah:5", kind: "divergence", cachedVersion: null },
          { type: "fold", subjectPseudonym: "u_def456", key: "12:ayah:9", kind: "skew", cachedVersion: "2026.08.01" },
        ],
        blockedBy: "1 of 7 consecutive green nights",
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/u_abc123/)).toBeTruthy());
    expect(screen.getByText(/12:ayah:5/)).toBeTruthy();
    expect(screen.getByText(/u_def456/)).toBeTruthy();
    expect(screen.getByText(/12:ayah:9/)).toBeTruthy();
    expect(screen.getByText(/2026\.08\.01/)).toBeTruthy();
  });

  /**
   * v3-D179: a `selection_determinism_check` P1's own findings (seed +
   * trace key, never a learner id) must render distinctly from a fold P1's
   * — never assumed to carry `subjectPseudonym`/`key`/`kind`.
   */
  it("a selection-check P1's findings render seed and trace key, never a fold-shaped label", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 1,
        required: 7,
        satisfied: false,
        windowStartedAt: "2026-09-01",
        windowReason: "engine merge abc1234",
        nights: [
          { night: "2026-09-04", green: true, severities: { selection_determinism_check: "green" }, missing: [] },
        ],
        lastP1: { night: "2026-09-03", check: "selection_determinism_check" },
        lastP1Findings: [
          {
            type: "selection",
            seed: 7,
            traceKey: "site-a:device-1:3",
            baseline: { lane: "s1" },
            replayed: { lane: "cloze" },
          },
        ],
        blockedBy: "1 of 7 consecutive green nights",
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/seed 7/)).toBeTruthy());
    expect(screen.getByText(/site-a:device-1:3/)).toBeTruthy();
    expect(screen.queryByText(/subjectPseudonym/)).toBeNull();
  });

  it("no confirmed P1 renders no findings section at all, never an empty one", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 7,
        required: 7,
        satisfied: true,
        windowStartedAt: "2026-09-01",
        windowReason: "engine merge abc1234",
        nights: [],
        lastP1: null,
        lastP1Findings: null,
        blockedBy: null,
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/7 of 7/)).toBeTruthy());
    expect(screen.queryByText(/findings/i)).toBeNull();
  });

  /**
   * v3-D230 — THE LOAD-BEARING CASE. The night that quarantined a learner is
   * a WARN night, and the ledger counts a WARN night as GREEN, so the table
   * row below reads `fold_determinism_check=warn (schedule)` and the streak
   * advances. Nothing on this screen said a learner had been skipped
   * entirely rather than checked and found clean. Two entries with DIFFERENT
   * pseudonyms and DIFFERENT errors, so the panel cannot satisfy this by
   * rendering one hardcoded line.
   */
  it("names each quarantined learner on a WARN night that still counts green (v3-D230)", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 2,
        required: 7,
        satisfied: false,
        windowStartedAt: "2026-09-01",
        windowReason: "test",
        nights: [
          {
            night: "2026-09-02",
            green: true,
            severities: { fold_determinism_check: "warn", selection_determinism_check: "green" },
            triggers: { fold_determinism_check: "schedule" },
            missing: [],
          },
        ],
        lastP1: null,
        lastP1Findings: null,
        lastQuarantine: {
          night: "2026-09-02",
          check: "fold_determinism_check",
          entries: [
            { subjectPseudonym: "u_abc123", error: "Malformed UTF-8 characters in device_id" },
            { subjectPseudonym: "u_def456", error: "Inf and NaN cannot be JSON encoded" },
          ],
        },
        blockedBy: "2 of 7 consecutive green nights",
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/u_abc123/)).toBeTruthy());
    expect(screen.getByText(/Malformed UTF-8 characters in device_id/)).toBeTruthy();
    expect(screen.getByText(/u_def456/)).toBeTruthy();
    expect(screen.getByText(/Inf and NaN cannot be JSON encoded/)).toBeTruthy();
    expect(screen.getByText(/quarantined on 2026-09-02/)).toBeTruthy();
    // The night itself still reads green — the reason the block above has to
    // exist at all.
    expect(screen.getByText(/fold_determinism_check=warn \(schedule\)/)).toBeTruthy();
  });

  /** Its negative sibling: a window where nobody was skipped paints no
   *  quarantine block at all, so the block above is a real signal rather
   *  than permanent chrome. */
  it("renders no quarantine block when nobody was skipped (v3-D230)", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 7,
        required: 7,
        satisfied: true,
        windowStartedAt: "2026-09-01",
        windowReason: "test",
        nights: [],
        lastP1: null,
        lastP1Findings: null,
        lastQuarantine: null,
        blockedBy: null,
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/7 of 7/)).toBeTruthy());
    expect(screen.queryByText(/quarantined/i)).toBeNull();
  });

  it("a night missing one check renders that check as MISSING, not silently dropped", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 0,
        required: 7,
        satisfied: false,
        windowStartedAt: "2026-09-01",
        windowReason: "test",
        nights: [
          {
            night: "2026-09-02",
            green: false,
            severities: { fold_determinism_check: "green" },
            missing: ["selection_determinism_check"],
          },
        ],
        lastP1: null,
        blockedBy: "0 of 7 consecutive green nights",
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/selection_determinism_check=MISSING/)).toBeTruthy());
  });
});
