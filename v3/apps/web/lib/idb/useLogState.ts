"use client";

// The one hook every component uses to read the log.
//
// It returns a LogState<T>, and consumers MUST switch on `.status`
// exhaustively — never `if (data)`, which is exactly how `empty` and `pending`
// get conflated back into an eternal skeleton. Because LogState is a
// discriminated union under `strict`, a missing case is a TYPE ERROR.

import { useEffect, useState } from "react";
import { openDb } from "./db.ts";
import { classifyIdbError, pending, readIntoState, type LogState } from "./state.ts";
import { writeLock, type WriterStatus } from "./writeLock.ts";

/**
 * Run `selector` against the open database and land the result in a LogState.
 *
 * @param selector  the read. Must be stable (useCallback) or the effect re-runs.
 * @param isEmpty   what "empty" means for THIS selector. Required, never a
 *                  truthiness default — see state.ts.
 * @param deps      extra dependencies (e.g. a surah number).
 */
export function useLogState<T>(
  selector: () => Promise<T>,
  isEmpty: (value: T) => boolean,
  deps: readonly unknown[] = [],
): LogState<T> {
  const [state, setState] = useState<LogState<T>>(pending<T>());

  useEffect(() => {
    let alive = true;
    setState(pending<T>());

    void (async () => {
      try {
        // Open first so an open failure is classified as such rather than
        // surfacing as a generic read failure.
        await openDb();
      } catch (err) {
        if (alive) setState({ status: "broken", reason: classifyIdbError(err) });
        return;
      }
      const next = await readIntoState(selector, isEmpty, "useLogState");
      if (alive) setState(next);
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

/** Subscribe to writer/reader status, so a second tab can render the
 *  read-only takeover banner and disable its commit path. */
export function useWriterStatus(): WriterStatus {
  const [status, setStatus] = useState<WriterStatus>(writeLock.current);
  useEffect(() => writeLock.subscribe(setStatus), []);
  return status;
}
