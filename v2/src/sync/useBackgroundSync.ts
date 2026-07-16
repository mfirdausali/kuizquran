// ROADMAP Phase 5: mounts the sync loop once at the app root. Mints this
// device's anonymous identity (v2-D03) if it doesn't have one yet, then
// hydrates (pulls any server history — the second-device restore path) and
// flushes (pushes local events up) on mount + whenever the tab regains
// connectivity/focus, mirroring v1's App.tsx sync effect. Purely additive —
// local-first (v2-D01) means every screen already works fully offline off the
// IndexedDB log; this effect only ever adds synced state on top.
import { useEffect } from "react";
import { ensureDevice } from "./auth.ts";
import { flush, hydrate } from "./outbox.ts";

export function useBackgroundSync(): void {
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const token = await ensureDevice();
      if (!token || cancelled) return;
      await hydrate();
      if (cancelled) return;
      await flush();
    };
    void sync();
    const onEvent = () => void sync();
    window.addEventListener("online", onEvent);
    window.addEventListener("focus", onEvent);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onEvent);
      window.removeEventListener("focus", onEvent);
    };
  }, []);
}
