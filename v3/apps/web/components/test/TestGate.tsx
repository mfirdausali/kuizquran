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
  | { kind: "ready"; surah: number; glossLang: GlossLang };

export function TestGate() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const choices = await readChoices();
      if (!alive) return;
      setState(
        choices && typeof choices.surah === "number"
          ? { kind: "ready", surah: choices.surah, glossLang: choices.glossLang }
          : { kind: "not-enrolled" },
      );
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state.kind === "loading") {
    return <p className="caption">Loading your enrollment…</p>;
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
