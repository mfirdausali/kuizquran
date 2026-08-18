"use client";

// THE CLIENT ISLAND that turns the event log into the growth curve.
//
// Same reason as `RetentionIsland.tsx` (edge case #72): a server render has
// no IndexedDB, so folding here would paint a permanent "Nothing encoded yet"
// that React then keeps in production once the client hydrates with the
// truth. The log is read here; nothing log-derived is computed in the page.
//
// Unlike retention, growth needs no corpus prop — `growthCurve()` is a pure
// function of the event log alone, so this island takes only `surah`.
//
// FOUR STATES, EXHAUSTIVELY — edge case #73, same as every other island.

import { useCallback } from "react";

import { getEventsForSurah, useLogState } from "@/lib/idb";
import type { LocalEventRow } from "@/lib/idb";
import { buildGrowthSummary } from "@/lib/progress/growth";
import { GrowthPanel } from "./GrowthPanel";

interface GrowthIslandProps {
  surah: number;
}

export function GrowthIsland({ surah }: GrowthIslandProps) {
  const selector = useCallback(() => getEventsForSurah(surah), [surah]);
  const isEmpty = useCallback((rows: LocalEventRow[]) => rows.length === 0, []);

  const state = useLogState<LocalEventRow[]>(selector, isEmpty, [surah]);

  switch (state.status) {
    case "pending":
      return (
        <div className="stack stack--tight" aria-busy="true">
          <p className="caption">
            <span className="skel" aria-hidden="true" />{" "}
            <span className="sr-only">Reading your growth…</span>
            reading your growth…
          </p>
        </div>
      );

    case "empty":
      return <GrowthPanel summary={buildGrowthSummary({ surah, events: [] })} />;

    case "ready":
      return <GrowthPanel summary={buildGrowthSummary({ surah, events: state.data })} />;

    case "broken":
      return (
        <div className="banner banner--warn" role="alert">
          <p>Your growth curve could not be read on this device.</p>
          <p className="sub">
            Reason: <code>{state.reason}</code>. Nothing has been lost — the log
            is append-only and re-readable once storage recovers.
          </p>
        </div>
      );
  }
}
