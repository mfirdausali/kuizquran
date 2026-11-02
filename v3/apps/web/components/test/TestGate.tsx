"use client";

// WHICH SURAH/LANG THE TEST DRILLS — read from the enrollment, never guessed.
// Same reason `SessionGate` is split from `SessionIsland`: the enrollment
// lives in IndexedDB, so it can only be read on the client, and keeping that
// read separate from `TestIsland` lets the island take plain props and stay
// trivially testable without a database.

import { useEffect, useState } from "react";
import Link from "next/link";

import type { GlossLang } from "@engine/types.ts";
import { readChoices } from "@/lib/onboarding/choices";
import { TestIsland } from "@/components/test/TestIsland";
import { ONBOARDING_HREF } from "@/lib/onboarding/surahs";

type State =
  | { kind: "loading" }
  | { kind: "not-enrolled" }
  | { kind: "broken"; message: string }
  | { kind: "ready"; surah: number; glossLang: GlossLang };

export function TestGate() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const choices = await readChoices();
        if (!alive) return;
        setState(
          choices && typeof choices.surah === "number"
            ? { kind: "ready", surah: choices.surah, glossLang: choices.glossLang }
            : { kind: "not-enrolled" },
        );
      } catch (err) {
        // A thrown read (a genuine IndexedDB open failure — blocked version
        // upgrade, quota, private mode) must show a state, never leave the
        // learner on the loading line forever. Mirrors SessionGate.tsx's own
        // `broken` state for the identical `readChoices()` call.
        if (!alive) return;
        setState({
          kind: "broken",
          message:
            err instanceof Error ? err.message : "Your enrollment could not be read.",
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state.kind === "loading") {
    return <p className="caption">Loading your enrollment…</p>;
  }

  if (state.kind === "broken") {
    return (
      <div className="banner banner--warn" role="alert">
        <p>Your enrollment could not be read on this device.</p>
        <p className="sub">
          Reason: <code>{state.message}</code>. Nothing has been lost — the log
          is append-only and your enrollment is re-read from it every time.
        </p>
      </div>
    );
  }

  if (state.kind === "not-enrolled") {
    return (
      <p className="caption">
        You haven&apos;t started a surah yet.{" "}
        <Link href={ONBOARDING_HREF}>Choose one</Link> to begin.
      </p>
    );
  }

  return <TestIsland surah={state.surah} glossLang={state.glossLang} />;
}
