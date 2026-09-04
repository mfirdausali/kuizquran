/**
 * @vitest-environment jsdom
 */

// `QariMode` role gating — the last item named unbuilt in
// DECISIONS.md v3-D127's own "NOT addressed" list: "role-based UI gating
// within the admin console (AdminGate proves ADMIN, not WHICH admin role)."
//
// Server-side this is already closed (v3-D92): `VerificationsController::store`
// requires `AdminRole::QARI` for `tier: qari`, and `GET /api/admin/whoami`
// already returns the caller's own `roles`. But `QariMode` offered the "Qari
// tier" option to every admin regardless of role — an operator/moderator
// admin could fill the whole form, submit, and only then learn from a 403
// that they were never eligible. That is the same "affordance the server
// will refuse" shape this codebase treats as a real UX defect elsewhere
// (locked library rows are not links; a disabled control explains why rather
// than pretending to work).
//
// This does not change what the SERVER accepts — `VerificationsController`
// is unmodified. It changes what the UI honestly offers, using the identity
// `AdminGate` already fetches and previously only displayed.
//
// No Arabic literal anywhere in this file.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QariMode } from "@/components/workbench/QariMode";
import { AdminIdentityProvider } from "@/lib/admin/identity-context";

afterEach(cleanup);

function renderQariMode(roles: string[] | null) {
  const body = (
    <QariMode surah={12} ayah={4} chip="unverified" onSigned={() => {}} />
  );
  if (roles === null) {
    // No provider at all — must default to the deny posture, never throw.
    return render(body);
  }
  return render(
    <AdminIdentityProvider identity={{ pseudonym: "u_test", roles }}>{body}</AdminIdentityProvider>,
  );
}

describe("QariMode — the qari-tier option is gated by the caller's own role", () => {
  it("disables the qari-tier radio for an admin with no qari role", () => {
    renderQariMode([]);
    const qariRadio = screen.getByRole("radio", { name: /qari tier/i }) as HTMLInputElement;
    expect(qariRadio.disabled).toBe(true);
  });

  it("disables the qari-tier radio for an admin holding only an unrelated role", () => {
    renderQariMode(["operator"]);
    const qariRadio = screen.getByRole("radio", { name: /qari tier/i }) as HTMLInputElement;
    expect(qariRadio.disabled).toBe(true);
  });

  it("explains why, in words, when the qari tier is unavailable", () => {
    renderQariMode([]);
    expect(screen.getByText(/requires the qari role/i)).toBeTruthy();
  });

  it("enables the qari-tier radio for an admin holding the qari role", () => {
    renderQariMode(["qari"]);
    const qariRadio = screen.getByRole("radio", { name: /qari tier/i }) as HTMLInputElement;
    expect(qariRadio.disabled).toBe(false);
  });

  it("never gates the admin tier — v3-D13 never conditioned it on scholarship", () => {
    renderQariMode([]);
    const adminRadio = screen.getByRole("radio", { name: /admin tier/i }) as HTMLInputElement;
    expect(adminRadio.disabled).toBe(false);
  });

  it("defaults the selected tier to admin when the caller cannot sign qari", () => {
    renderQariMode([]);
    // The button label mirrors the currently-selected tier — asserting on it
    // proves the SELECTION defaulted away from the disabled option, not only
    // that the disabled input itself is unchecked.
    expect(screen.getByRole("button", { name: /sign admin tier/i })).toBeTruthy();
  });

  it("still defaults the selected tier to qari when the caller holds the role", () => {
    renderQariMode(["qari"]);
    expect(screen.getByRole("button", { name: /sign qari tier/i })).toBeTruthy();
  });

  it("with no identity provider at all, denies by default rather than throwing", () => {
    expect(() => renderQariMode(null)).not.toThrow();
    const qariRadio = screen.getByRole("radio", { name: /qari tier/i }) as HTMLInputElement;
    expect(qariRadio.disabled).toBe(true);
  });
});

describe("QariMode — v3-D167: the signature history for this ayah is rendered, not just fetched", () => {
  // `lib/workbench/verifications.ts` has fetched and typed every prior
  // `VerificationRow` (tier, reviewerKind, verifiedBy, note, createdAt) for a
  // surah since step 15, and v3-D152 wired the raw array through as far as
  // `describeCertification` — but nothing ever rendered a SINGLE row. A
  // reviewer opening an ayah could see today's chip and, after their OWN
  // submission, the result of that one action — never who signed a PRIOR
  // verification, when, or why (a rejection note).
  const row = {
    id: 5,
    surah: 12,
    ayah: 4,
    tier: "qari" as const,
    contentHash: "abc",
    hashSpecVersion: 1,
    reviewerKind: "human" as const,
    verifiedBy: "reviewer@example.test",
    note: "checked distractor 3, wrong root — resubmit",
    createdAt: 1735689600000, // 2025-01-01T00:00:00.000Z
  };

  it("renders tier, reviewer kind, who signed, when, and their note", () => {
    render(
      <QariMode surah={12} ayah={4} chip="stale" onSigned={() => {}} history={[row]} />,
    );
    // Scoped to the ONE history row, not the whole page — the tier picker
    // below it also carries the words "qari"/"human" in unrelated controls
    // (e.g. the disabled-qari-tier caption), so a loose page-wide match would
    // pass even if the history row itself rendered nothing.
    const historyItem = screen.getByRole("listitem");
    expect(historyItem.textContent).toContain("qari");
    expect(historyItem.textContent).toContain("human");
    expect(historyItem.textContent).toContain("reviewer@example.test");
    expect(historyItem.textContent).toContain("2025-01-01T00:00:00.000Z");
    expect(historyItem.textContent).toContain("checked distractor 3, wrong root — resubmit");
    // v3-D177: `contentHash`/`hashSpecVersion` are fetched and typed on every
    // `VerificationRow` (the exact hash this row was signed against) but were
    // never rendered — a reviewer could not tell a PRIOR signature's hash
    // spec version from the CURRENT one, or see the hash it actually covered.
    expect(historyItem.textContent).toContain("v1");
    expect(historyItem.textContent).toContain("abc");
  });

  it("falls back to — for a null verifiedBy, never a fabricated value", () => {
    render(
      <QariMode
        surah={12}
        ayah={4}
        chip="stale"
        onSigned={() => {}}
        history={[{ ...row, verifiedBy: null, note: null }]}
      />,
    );
    expect(screen.getByText(/signed by\s+—/)).toBeTruthy();
    expect(screen.queryByText(/reviewer@example\.test/)).toBeNull();
    // A null note is dropped entirely — never rendered as a stray ": —".
    expect(screen.queryByText(/: —/)).toBeNull();
  });

  it("says so honestly when there is no history yet for this ayah", () => {
    render(<QariMode surah={12} ayah={4} chip="unverified" onSigned={() => {}} history={[]} />);
    expect(screen.getByText(/no signatures yet/i)).toBeTruthy();
  });

  it("history is optional — omitting the prop renders the empty state, never a crash", () => {
    expect(() =>
      render(<QariMode surah={12} ayah={4} chip="unverified" onSigned={() => {}} />),
    ).not.toThrow();
    expect(screen.getByText(/no signatures yet/i)).toBeTruthy();
  });
});
