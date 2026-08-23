/**
 * @vitest-environment jsdom
 */

// `PrivacyPanel` — the missing UI half of `Admin\RevealController` and
// `Admin\AdminUsersController::exportCsv` (build-plan step 24, M8,
// WIREFRAME §16). Both backends and their own suite
// (`AdminPrivacyTest.php`) have existed since build-plan step 24 shipped,
// but nothing under `apps/web` ever rendered them — the same shape as
// v3-D100/D124/D125/D126. Mirrors `test/flags-panel.test.tsx`'s discipline:
// the server decides everything (reason-code set, >=10-char minimum, PII
// scan, TTL); this panel carries fields and renders responses verbatim.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { PrivacyPanel } from "@/components/admin/PrivacyPanel";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("PrivacyPanel — reveal", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:mock-url";
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("Reveal is disabled until a user id and a >=10-char reason are both present", () => {
    render(<PrivacyPanel />);
    const revealButton = screen.getByRole("button", { name: "Reveal" }) as HTMLButtonElement;
    expect(revealButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/User id/i), { target: { value: "42" } });
    expect(revealButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Details/i), { target: { value: "short" } });
    expect(revealButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Details/i), { target: { value: "a sufficiently long reason" } });
    expect(revealButton.disabled).toBe(false);
  });

  it("a successful reveal renders the identity and a re-mask countdown", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        pseudonym: "u_abc123",
        identity: { email: "learner@example.com", name: "Test Learner" },
        revealToken: "tok_1",
        expiresAt: Date.now() + 900_000,
      }),
    ) as unknown as typeof fetch;

    render(<PrivacyPanel />);
    fireEvent.change(screen.getByLabelText(/User id/i), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText(/Details/i), { target: { value: "investigating ticket 4821" } });
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    const resultView = await screen.findByTestId("reveal-result");
    const text = resultView.textContent ?? "";
    expect(text).toContain("u_abc123");
    expect(text).toContain("learner@example.com");
    expect(text).toContain("Test Learner");
    expect(text).toMatch(/Re-masks in/);
  });

  it("edge case #148 — an anonymous subject renders a defined message, not identity", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ pseudonym: "u_def456", identity: null, reason: "anonymous — no identity held" }),
    ) as unknown as typeof fetch;

    render(<PrivacyPanel />);
    fireEvent.change(screen.getByLabelText(/User id/i), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText(/Details/i), { target: { value: "checking an abuse report" } });
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    const resultView = await screen.findByTestId("reveal-result");
    const text = resultView.textContent ?? "";
    expect(text).toContain("u_def456");
    expect(text).toMatch(/anonymous/);
    expect(text).not.toContain("@");
  });

  it("edge case #149 — a PII-shaped reason shows the server's warning and an acknowledgement checkbox", async () => {
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

    render(<PrivacyPanel />);
    fireEvent.change(screen.getByLabelText(/User id/i), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText(/Details/i), {
      target: { value: "ticket from ahmad.faiz@gmail.com about a session" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    const warning = await screen.findByTestId("pii-warning");
    expect(warning.textContent ?? "").toContain("email-shaped string");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("acknowledging the PII warning re-submits with acknowledge_pii_warning:true", async () => {
    let call = 0;
    const bodies: unknown[] = [];
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      call += 1;
      bodies.push(init?.body ? JSON.parse(String(init.body)) : null);
      if (call === 1) {
        return jsonResponse(
          { error: "PII detected", detected: ["email-shaped string"], hint: "hint" },
          422,
        );
      }
      return jsonResponse({
        pseudonym: "u_abc123",
        identity: { email: "learner@example.com", name: null },
        revealToken: "tok_2",
        expiresAt: Date.now() + 900_000,
      });
    }) as unknown as typeof fetch;

    render(<PrivacyPanel />);
    fireEvent.change(screen.getByLabelText(/User id/i), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText(/Details/i), {
      target: { value: "ticket from ahmad.faiz@gmail.com about a session" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    await screen.findByTestId("pii-warning");

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    await screen.findByTestId("reveal-result");
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toMatchObject({ acknowledge_pii_warning: true });
  });

  it("re-check reports the server's own verdict, never a client-derived one", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/reveal/tok_1")) {
        return jsonResponse({ valid: false, reason: "expired or unknown" }, 403);
      }
      return jsonResponse({
        pseudonym: "u_abc123",
        identity: { email: "learner@example.com", name: null },
        revealToken: "tok_1",
        expiresAt: Date.now() + 900_000,
      });
    }) as unknown as typeof fetch;

    render(<PrivacyPanel />);
    fireEvent.change(screen.getByLabelText(/User id/i), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText(/Details/i), { target: { value: "investigating ticket 4821" } });
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    await screen.findByTestId("reveal-result");

    fireEvent.click(screen.getByRole("button", { name: "Re-check token" }));
    await waitFor(() => expect(screen.getByText(/re-masked/i)).toBeTruthy());
  });
});

describe("PrivacyPanel — CSV export", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:mock-url";
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("requests the identity-free CSV and reports success", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response("pseudonym\nu_abc\n", { status: 200, headers: { "Content-Type": "text/csv" } });
    }) as unknown as typeof fetch;

    render(<PrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Download users.csv" }));

    await waitFor(() => expect(screen.getByText("downloaded")).toBeTruthy());
    expect(seen[0]).toContain("/api/admin/users/export.csv");
  });
});
