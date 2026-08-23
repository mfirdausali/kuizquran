"use client";

// THE USERS-CSV-EXPORT CLIENT (build-plan step 24, M8) — the missing frontend
// half of `Admin\AdminUsersController::exportCsv`.
//
// The backend has existed, fully tested (`AdminPrivacyTest.php`, incl. the
// M10 security-review fix auditing the export BEFORE the stream opens), since
// build-plan step 24 landed, but nothing under `apps/web` ever called it.
//
// THERE IS NO "INCLUDE EMAILS" OPTION HERE EITHER. `AdminUsersController`'s
// own header: a checkbox is a thing an operator can be socially engineered
// into ticking. This module sends no parameter the endpoint doesn't already
// ignore by design and adds none of its own.
//
// The endpoint requires a Bearer token, so a plain `<a href>` cannot
// authenticate it — the browser's download machinery is driven manually here
// (object URL + a detached anchor's `.click()`), the standard pattern for an
// authenticated download.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6).

import { apiFetch } from "@/lib/sync/apiFetch.ts";

export interface DownloadOutcome {
  ok: boolean;
  message: string;
}

/** Triggers a browser download of the identity-free users CSV. Never throws. */
export async function downloadUsersCsv(): Promise<DownloadOutcome> {
  let response: Response;
  try {
    response = await apiFetch("/api/admin/users/export.csv");
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? `request failed: ${err.message}` : "request failed",
    };
  }

  if (!response.ok) {
    return { ok: false, message: `the API answered ${response.status}` };
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = "users.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }

  return { ok: true, message: "downloaded" };
}
