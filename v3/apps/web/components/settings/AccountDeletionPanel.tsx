"use client";

// PDPA delete/restore — the destructive half of gate 19.
//
// Mirrors the two disciplines this codebase already established for
// destructive actions:
//
//   1. ENUMERATE BEFORE DESTROY (edge case #104, `DeviceReset`). The confirm
//      step reads the real event/surah count from the server's own export
//      before offering the button — a confirm rendered before that read
//      finished would be a confirm about an unknown quantity.
//   2. A FAILED READ NEVER PAINTS A FALSE "NOTHING PENDING" (the same
//      three-state discipline as `lib/workbench/verifications.ts`). If the
//      server's deletion status cannot be confirmed, deletion is not offered
//      at all — requesting one blind risks a spurious duplicate, and
//      silently trusting "not pending" risks a learner never finding the
//      cancel form for a deletion that is, in fact, already scheduled.
//
// The restore token is server-generated, shown exactly once, and never
// re-derivable (`AccountController::requestDeletion`'s own comment). This
// component holds it in memory only for the request that just created it —
// a fresh page load has no token, and the pending view asks the learner to
// paste back whatever they saved.

import { useCallback, useEffect, useState } from "react";
import {
  fetchAccountExport,
  fetchDeletionStatus,
  requestAccountDeletion,
  restoreAccountDeletion,
} from "@/lib/account/api.ts";

type View =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: string }
  | { kind: "idle" }
  | { kind: "counting" }
  | { kind: "confirming"; events: number | null; surahs: number | null }
  | { kind: "requesting" }
  | { kind: "request-error"; reason: string }
  | { kind: "scheduled"; restoreToken: string; purgeAt: number }
  | { kind: "pending"; purgeAt: number; requestedAt: number }
  | { kind: "restored" };

type RestoreState =
  | { kind: "idle" }
  | { kind: "restoring" }
  | { kind: "error"; reason: string };

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(ms));
}

export function AccountDeletionPanel() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [restoreInput, setRestoreInput] = useState("");
  const [restoreState, setRestoreState] = useState<RestoreState>({ kind: "idle" });

  const loadStatus = useCallback(() => {
    setView({ kind: "loading" });
    void (async () => {
      const load = await fetchDeletionStatus();
      if (load.state === "unavailable") {
        setView({ kind: "unavailable", reason: load.reason });
        return;
      }
      setView(
        load.status.pending
          ? { kind: "pending", purgeAt: load.status.purgeAt, requestedAt: load.status.requestedAt }
          : { kind: "idle" },
      );
    })();
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const startConfirm = useCallback(() => {
    setView({ kind: "counting" });
    void (async () => {
      const result = await fetchAccountExport();
      if (result.state !== "ready") {
        setView({ kind: "confirming", events: null, surahs: null });
        return;
      }
      const surahs = new Set(
        result.data.events
          .map((e) => e.surah)
          .filter((s): s is number => typeof s === "number"),
      );
      setView({ kind: "confirming", events: result.data.events.length, surahs: surahs.size });
    })();
  }, []);

  const confirmDelete = useCallback(() => {
    setView({ kind: "requesting" });
    void (async () => {
      const result = await requestAccountDeletion();
      switch (result.state) {
        case "scheduled":
          setView({ kind: "scheduled", restoreToken: result.restoreToken, purgeAt: result.purgeAt });
          return;
        case "already-pending":
          loadStatus();
          return;
        case "forbidden":
        case "failed":
          setView({ kind: "request-error", reason: result.reason });
          return;
      }
    })();
  }, [loadStatus]);

  const submitRestore = useCallback((token: string) => {
    setRestoreState({ kind: "restoring" });
    void (async () => {
      const result = await restoreAccountDeletion(token);
      if (result.state === "restored") {
        setRestoreState({ kind: "idle" });
        setRestoreInput("");
        setView({ kind: "restored" });
        return;
      }
      setRestoreState({
        kind: "error",
        reason:
          result.state === "not-found"
            ? "that token does not match a pending deletion on this account"
            : result.reason,
      });
    })();
  }, []);

  switch (view.kind) {
    case "loading":
      return (
        <p className="caption">
          <span className="skel" aria-hidden="true" />{" "}
          <span className="sr-only">Checking your account status…</span>
          checking your account status…
        </p>
      );

    case "unavailable":
      return (
        <div className="banner banner--warn" role="alert">
          <p>Could not check your account status.</p>
          <p className="sub">
            Reason: <code>{view.reason}</code>. Deletion is not offered while
            this cannot be confirmed.
          </p>
        </div>
      );

    case "idle":
      return (
        <div className="stack stack--tight">
          <p className="caption">
            Deleting your account schedules a permanent purge after a grace
            period. You get a one-time token to cancel during that window;
            once it elapses, nobody — including us — can bring it back.
          </p>
          <button type="button" className="btn btn--ghost hit" onClick={startConfirm}>
            Delete my account
          </button>
        </div>
      );

    case "counting":
      return (
        <p className="caption">
          <span className="skel" aria-hidden="true" />{" "}
          <span className="sr-only">Working out what would be deleted…</span>
          working out what would be deleted…
        </p>
      );

    case "confirming":
      return (
        <div className="stack stack--tight">
          <div className="banner banner--warn" role="alert">
            <p>This schedules your account for permanent deletion.</p>
            <p className="sub">
              {view.events !== null && view.surahs !== null ? (
                <>
                  {view.events} recorded event{view.events === 1 ? "" : "s"}
                  {view.surahs > 0
                    ? ` across ${view.surahs} surah${view.surahs === 1 ? "" : "s"}`
                    : ""}
                  , plus your account itself, will be permanently deleted once
                  the grace period elapses.
                </>
              ) : (
                <>
                  Every recorded event and your account itself will be
                  permanently deleted once the grace period elapses (the exact
                  count could not be confirmed).
                </>
              )}{" "}
              You will get a one-time token to cancel during the window.
            </p>
          </div>
          <div className="settings-confirm-row">
            <button
              type="button"
              className="btn btn--ghost hit"
              onClick={() => setView({ kind: "idle" })}
            >
              Cancel
            </button>
            <button type="button" className="btn btn--primary hit" onClick={confirmDelete}>
              Yes, delete my account
            </button>
          </div>
        </div>
      );

    case "requesting":
      return (
        <p className="caption">
          <span className="skel" aria-hidden="true" />{" "}
          <span className="sr-only">Scheduling deletion…</span>
          scheduling deletion…
        </p>
      );

    case "request-error":
      return (
        <div className="stack stack--tight">
          <div className="banner banner--warn" role="alert">
            <p>Could not schedule deletion.</p>
            <p className="sub">
              Reason: <code>{view.reason}</code>
            </p>
          </div>
          <button type="button" className="btn btn--ghost hit" onClick={() => setView({ kind: "idle" })}>
            Back
          </button>
        </div>
      );

    case "scheduled":
      return (
        <div className="stack stack--tight">
          <div className="banner banner--warn" role="status">
            <p>Deletion scheduled for {formatDate(view.purgeAt)}.</p>
            <p className="sub">
              Your one-time restore token — save it now. It is shown only once
              and cannot be recovered later.
            </p>
            <p className="sub">
              <code className="ltr-island">{view.restoreToken}</code>
            </p>
          </div>
          <RestoreForm
            busy={restoreState.kind === "restoring"}
            error={restoreState.kind === "error" ? restoreState.reason : null}
            onSubmit={() => submitRestore(view.restoreToken)}
            hideInput
          />
        </div>
      );

    case "pending":
      return (
        <div className="stack stack--tight">
          <div className="banner banner--warn" role="status">
            <p>Deletion scheduled for {formatDate(view.purgeAt)}.</p>
            <p className="sub">
              Requested {formatDate(view.requestedAt)}. If you saved the
              restore token shown at request time, enter it below to cancel.
            </p>
          </div>
          <RestoreForm
            busy={restoreState.kind === "restoring"}
            error={restoreState.kind === "error" ? restoreState.reason : null}
            value={restoreInput}
            onChange={setRestoreInput}
            onSubmit={() => submitRestore(restoreInput)}
          />
        </div>
      );

    case "restored":
      return (
        <div className="banner banner--ok" role="status">
          <p>Deletion cancelled. Your account is no longer scheduled for removal.</p>
        </div>
      );
  }
}

interface RestoreFormProps {
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
  value?: string;
  onChange?: (v: string) => void;
  /** The just-scheduled view already holds the token in memory — no need to
   *  ask the learner to retype what they were just shown. */
  hideInput?: boolean;
}

function RestoreForm({ busy, error, onSubmit, value, onChange, hideInput }: RestoreFormProps) {
  const disabled = busy || (!hideInput && (value ?? "").trim() === "");
  return (
    <form
      className="stack stack--tight"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit();
      }}
    >
      {hideInput ? null : (
        <div className="stack stack--tight">
          <label className="table-toolbar__label" htmlFor="restore-token">
            Restore token
          </label>
          <input
            id="restore-token"
            type="text"
            className="settings-input"
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
            autoComplete="off"
          />
        </div>
      )}
      <button type="submit" className="btn btn--ghost hit" disabled={disabled}>
        {busy ? "Cancelling…" : "Cancel deletion"}
      </button>
      {error ? (
        <p className="caption" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
