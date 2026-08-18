"use client";

// THE CLIENT ISLAND that turns the event log into a Test history list.
//
// Same reason as `RetentionIsland.tsx`/`GrowthIsland.tsx` (edge case #72): a
// server render has no IndexedDB, so folding here would paint a permanent
// "No Tests taken yet" that React then keeps in production once the client
// hydrates with the truth. The log is read here; nothing log-derived is
// computed in the page.
//
// Like growth, this needs no corpus prop — `testHistory()` is a pure
// function of the event log alone (`test_result` events carry their own
// range and score). `tz` is passed through unchanged for the date label.
//
// FOUR STATES, EXHAUSTIVELY — edge case #73, same as every other island.

import { useCallback } from "react";

import { getEventsForSurah, useLogState } from "@/lib/idb";
import type { LocalEventRow } from "@/lib/idb";
import { buildTestHistorySummary } from "@/lib/progress/testHistory";
import { TestHistoryPanel } from "./TestHistoryPanel";

interface TestHistoryIslandProps {
  surah: number;
  tz: string;
}

export function TestHistoryIsland({ surah, tz }: TestHistoryIslandProps) {
  const selector = useCallback(() => getEventsForSurah(surah), [surah]);
  const isEmpty = useCallback((rows: LocalEventRow[]) => rows.length === 0, []);

  const state = useLogState<LocalEventRow[]>(selector, isEmpty, [surah]);

  switch (state.status) {
    case "pending":
      return (
        <div className="stack stack--tight" aria-busy="true">
          <p className="caption">
            <span className="skel" aria-hidden="true" />{" "}
            <span className="sr-only">Reading your Test history…</span>
            reading your Test history…
          </p>
        </div>
      );

    case "empty":
      return (
        <TestHistoryPanel summary={buildTestHistorySummary({ surah, events: [], tz })} />
      );

    case "ready":
      return (
        <TestHistoryPanel
          summary={buildTestHistorySummary({ surah, events: state.data, tz })}
        />
      );

    case "broken":
      return (
        <div className="banner banner--warn" role="alert">
          <p>Your Test history could not be read on this device.</p>
          <p className="sub">
            Reason: <code>{state.reason}</code>. Nothing has been lost — the log
            is append-only and re-readable once storage recovers.
          </p>
        </div>
      );
  }
}
