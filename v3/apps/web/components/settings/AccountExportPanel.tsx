"use client";

// PDPA "right to access" — the download half of gate 19.
//
// Fetches the export once, on demand (never on mount: nobody should pay for
// pulling their whole event history just for landing on this screen), turns
// it into a `Blob`, and triggers a same-tab download. The file never touches
// a server other than the one that produced it — no third-party upload, no
// clipboard.

import { useCallback, useState } from "react";
import { fetchAccountExport } from "@/lib/account/api.ts";

type State = "idle" | "loading" | "done" | "error";

export function AccountExportPanel() {
  const [state, setState] = useState<State>("idle");
  const [reason, setReason] = useState<string | null>(null);

  const download = useCallback(() => {
    setState("loading");
    setReason(null);
    void (async () => {
      const result = await fetchAccountExport();
      if (result.state === "failed") {
        setState("error");
        setReason(result.reason);
        return;
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iman-account-export-${result.data.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState("done");
    })();
  }, []);

  return (
    <div className="stack stack--tight">
      <p className="caption">
        Download everything recorded under your account — your profile and
        every drill event — as one JSON file.
      </p>
      <button
        type="button"
        className="btn btn--primary hit"
        onClick={download}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Preparing your export…" : "Download my data"}
      </button>
      <p role="status" className="caption">
        {state === "done" ? "Downloaded." : null}
      </p>
      {state === "error" ? (
        <div className="banner banner--warn" role="alert">
          <p>Could not prepare your export.</p>
          <p className="sub">
            Reason: <code>{reason}</code>. Nothing was downloaded — try again in a
            moment.
          </p>
        </div>
      ) : null}
    </div>
  );
}
