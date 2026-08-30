/**
 * @vitest-environment jsdom
 */

// THE SETTINGS SCREEN (build-plan step 23 / M7, LAUNCH-CHECKLIST.md gate 19).
//
// What a pure-function test on lib/account/api.ts cannot reach:
//
//   1. THE THREE-STATE DISCIPLINE ON SCREEN. "Checking…" / "not offered
//      (unavailable)" / "offered" must be three DISTINCT renders — a
//      component that paints the idle "Delete my account" button while the
//      status read is still in flight would let a learner fire a request
//      the app cannot yet confirm is safe.
//   2. ENUMERATE BEFORE DESTROY. The confirm step must show the real
//      event/surah count BEFORE the destructive button is reachable.
//   3. THE RESTORE TOKEN IS SHOWN EXACTLY ONCE, in the response to a
//      successful request, and the pending-on-reload view never invents one.
//   4. THE EXPORT BUTTON ACTUALLY TRIGGERS A DOWNLOAD (an anchor with a
//      `download` attribute pointing at an object URL), not merely "some
//      network call happened".

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { AccountExportPanel } from "@/components/settings/AccountExportPanel";
import { AccountDeletionPanel } from "@/components/settings/AccountDeletionPanel";
import { AnchorHourPanel } from "@/components/settings/AnchorHourPanel";

interface Recorded {
  url: string;
  method: string;
  body: unknown;
}

let recorded: Recorded[] = [];
let queue: Array<{ status: number; body: unknown }> = [];

function stubFetch() {
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
}

beforeEach(() => {
  recorded = [];
  queue = [];
  stubFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const EXPORT_BODY = {
  exportedAt: "2026-08-12T00:00:00+00:00",
  account: {
    id: 1,
    email: null,
    name: null,
    isAnonymous: true,
    createdAt: null,
    emailVerifiedAt: null,
  },
  events: [
    { surah: 12, ayah: 1 },
    { surah: 12, ayah: 2 },
    { surah: 67, ayah: 1 },
  ],
};

describe("AccountExportPanel", () => {
  it("downloads the export as a JSON object-URL anchor", async () => {
    queue.push({ status: 200, body: EXPORT_BODY });
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<AccountExportPanel />);
    fireEvent.click(screen.getByRole("button", { name: /download my data/i }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    expect(recorded).toEqual([{ url: "/api/account/export", method: "GET", body: undefined }]);
    expect(screen.getByRole("status").textContent).toContain("Downloaded");

    clickSpy.mockRestore();
  });

  it("a failed export renders a banner, never a silent no-op", async () => {
    queue.push({ status: 500, body: {} });
    render(<AccountExportPanel />);
    fireEvent.click(screen.getByRole("button", { name: /download my data/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not prepare your export");
  });

  /** v3-D157: `AccountController::export()` gained
   *  `entitlement`/`entitlementTransitions`/`billingEvents` beyond
   *  `account`/`events` — this proves the downloaded FILE carries them
   *  verbatim, not merely that `fetchAccountExport`'s return value does.
   *  The panel serializes `result.data` directly (`JSON.stringify`, no
   *  field-by-field re-assembly), so this is the one place a future
   *  refactor toward an explicit allowlist would be caught.
   *
   *  jsdom's `Blob` has no `.text()`/`.arrayBuffer()` (confirmed directly:
   *  `new (require("jsdom").JSDOM)().window.Blob.prototype.text` is
   *  `undefined`), so this captures the exact bytes the component hands to
   *  `new Blob(...)` at construction time instead of reading them back off
   *  a constructed Blob — a direct check of what the download would
   *  contain, not a round-trip through an API jsdom doesn't implement. */
  it("the downloaded file includes billing/entitlement history, not just events", async () => {
    queue.push({
      status: 200,
      body: {
        ...EXPORT_BODY,
        entitlement: { state: "trial", tier: "lifetime" },
        entitlementTransitions: [
          { from_state: "trial", to_state: "active", provider_event_id: "evt_transition_1" },
        ],
        billingEvents: [{ provider: "stripe", provider_event_id: "evt_billing_1" }],
      },
    });
    const RealBlob = globalThis.Blob;
    let capturedText: string | null = null;
    vi.stubGlobal(
      "Blob",
      vi.fn((parts: BlobPart[], options?: BlobPropertyBag) => {
        capturedText = (parts as string[]).join("");
        return new RealBlob(parts, options);
      }),
    );
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<AccountExportPanel />);
    fireEvent.click(screen.getByRole("button", { name: /download my data/i }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(capturedText).not.toBeNull();
    expect(capturedText).toContain("evt_transition_1");
    expect(capturedText).toContain("evt_billing_1");
    expect(capturedText).toContain("lifetime");

    clickSpy.mockRestore();
  });
});

describe("AccountDeletionPanel — the three-state status read", () => {
  it("LOADING then IDLE — offers deletion only once the status is confirmed", async () => {
    queue.push({ status: 200, body: { pending: false } });
    render(<AccountDeletionPanel />);
    expect(screen.queryByRole("button", { name: /delete my account/i })).toBeNull();
    expect(await screen.findByRole("button", { name: /delete my account/i })).toBeTruthy();
  });

  it("UNAVAILABLE — deletion is NOT offered, and the reason is shown", async () => {
    queue.push({ status: 500, body: {} });
    render(<AccountDeletionPanel />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not check your account status");
    expect(screen.queryByRole("button", { name: /delete my account/i })).toBeNull();
  });

  it("PENDING on load — shows the scheduled date and a manual restore form, with NO token displayed", async () => {
    queue.push({
      status: 200,
      body: { pending: true, requestedAt: 1_700_000_000_000, purgeAt: 1_701_000_000_000 },
    });
    render(<AccountDeletionPanel />);
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Deletion scheduled for");
    // No restore token exists in memory on a fresh load — the field must be
    // present so a learner who saved theirs can paste it back.
    expect(screen.getByLabelText(/restore token/i)).toBeTruthy();
  });
});

describe("AccountDeletionPanel — enumerate before destroy", () => {
  it("counts real events/surahs from the export BEFORE the destructive button is reachable", async () => {
    queue.push({ status: 200, body: { pending: false } });
    queue.push({ status: 200, body: EXPORT_BODY });
    render(<AccountDeletionPanel />);

    fireEvent.click(await screen.findByRole("button", { name: /delete my account/i }));

    const confirmAlert = await screen.findByRole("alert");
    expect(confirmAlert.textContent).toContain("3 recorded events");
    expect(confirmAlert.textContent).toContain("across 2 surahs");

    // The destructive action is reachable only inside this confirm step.
    expect(screen.getByRole("button", { name: /yes, delete my account/i })).toBeTruthy();
  });

  it("Cancel returns to idle without requesting anything destructive", async () => {
    queue.push({ status: 200, body: { pending: false } });
    queue.push({ status: 200, body: EXPORT_BODY });
    render(<AccountDeletionPanel />);

    fireEvent.click(await screen.findByRole("button", { name: /delete my account/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^cancel$/i }));

    expect(await screen.findByRole("button", { name: /delete my account/i })).toBeTruthy();
    // Only the status GET and the export count GET happened — never a POST.
    expect(recorded.filter((r) => r.method === "POST")).toHaveLength(0);
  });
});

describe("AccountDeletionPanel — request, then restore in the SAME session", () => {
  it("shows the one-time token after scheduling, and restoring it clears the pending state", async () => {
    queue.push({ status: 200, body: { pending: false } }); // initial status
    queue.push({ status: 200, body: EXPORT_BODY }); // enumerate
    queue.push({
      status: 201,
      body: { ok: true, restoreToken: "secret-token-abc", requestedAt: 1, purgeAt: 2 },
    }); // request
    queue.push({ status: 200, body: { ok: true, restored: true } }); // restore

    render(<AccountDeletionPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /delete my account/i }));
    fireEvent.click(await screen.findByRole("button", { name: /yes, delete my account/i }));

    const scheduled = await screen.findByRole("status");
    expect(scheduled.textContent).toContain("secret-token-abc");

    fireEvent.click(screen.getByRole("button", { name: /cancel deletion/i }));

    // `role="status"` was already satisfied by the scheduled banner before
    // this click, so `findByRole` alone would resolve immediately against
    // stale content — wait for the text that only the restored view renders.
    expect(await screen.findByText(/Deletion cancelled/i)).toBeTruthy();

    // The restore POST carried the token this component held in memory —
    // never a re-typed or re-derived one.
    const restoreCall = recorded.find((r) => r.url === "/api/account/deletion/restore");
    expect(restoreCall?.body).toEqual({ token: "secret-token-abc" });
  });

  it("an already-pending 409 reloads the real status instead of fabricating a token", async () => {
    queue.push({ status: 200, body: { pending: false } });
    queue.push({ status: 200, body: EXPORT_BODY });
    queue.push({ status: 409, body: { error: "a deletion is already pending" } });
    queue.push({ status: 200, body: { pending: true, requestedAt: 1, purgeAt: 2 } }); // re-fetched status

    render(<AccountDeletionPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /delete my account/i }));
    fireEvent.click(await screen.findByRole("button", { name: /yes, delete my account/i }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Deletion scheduled for");
    expect(status.textContent).not.toContain("secret");
  });
});

describe("AnchorHourPanel (v3-D140)", () => {
  it("LOADING then IDLE — the picker is not offered until the real value is known", async () => {
    queue.push({ status: 200, body: { anchorHour: 8 } });
    render(<AnchorHourPanel />);

    expect(screen.queryByRole("button", { name: /after breakfast/i })).toBeNull();
    expect(await screen.findByRole("button", { name: /after breakfast/i })).toBeTruthy();
    expect(recorded).toEqual([{ url: "/api/settings", method: "GET", body: undefined }]);
  });

  it("UNAVAILABLE on a failed read — no picker, and the reason is shown", async () => {
    queue.push({ status: 500, body: {} });
    render(<AnchorHourPanel />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not read your daily anchor");
    expect(screen.queryByRole("button", { name: /evening/i })).toBeNull();
  });

  it("marks the currently saved hour as pressed, not merely highlighted", async () => {
    queue.push({ status: 200, body: { anchorHour: 13 } });
    render(<AnchorHourPanel />);

    const midday = await screen.findByRole("button", { name: /^midday$/i });
    expect(midday.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /evening/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("choosing a new anchor POSTs exactly that hour and re-renders it as saved", async () => {
    queue.push({ status: 200, body: { anchorHour: 8 } });
    queue.push({ status: 200, body: { ok: true, anchorHour: 20 } });
    render(<AnchorHourPanel />);

    fireEvent.click(await screen.findByRole("button", { name: /^evening$/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^evening$/i }).getAttribute("aria-pressed")).toBe(
        "true",
      ),
    );
    const postCall = recorded.find((r) => r.method === "POST");
    expect(postCall).toEqual({ url: "/api/settings", method: "POST", body: { anchorHour: 20 } });
  });

  it("a failed save keeps reporting the PREVIOUS saved value, never the rejected attempt", async () => {
    queue.push({ status: 200, body: { anchorHour: 8 } });
    queue.push({ status: 400, body: { error: "anchorHour (number, 0-24) required" } });
    render(<AnchorHourPanel />);

    fireEvent.click(await screen.findByRole("button", { name: /^evening$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not save your anchor");
    // The original choice (8 = "after breakfast") is still the pressed one —
    // the rejected "evening" attempt never became the displayed truth.
    expect(
      screen.getByRole("button", { name: /after breakfast/i }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: /^evening$/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
});

describe("AccountDeletionPanel — restoring a wrong token on the pending view", () => {
  it("a 404 renders an inline error naming the mismatch, not a token oracle", async () => {
    queue.push({ status: 200, body: { pending: true, requestedAt: 1, purgeAt: 2 } });
    queue.push({ status: 404, body: { error: "no matching pending deletion" } });

    render(<AccountDeletionPanel />);
    const input = await screen.findByLabelText(/restore token/i);
    fireEvent.change(input, { target: { value: "wrong-one" } });
    fireEvent.click(screen.getByRole("button", { name: /cancel deletion/i }));

    const error = await screen.findByText(/does not match a pending deletion/i);
    expect(error).toBeTruthy();
  });
});
