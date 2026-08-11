"use client";

// WHICH SURAH THE LEARNER IS ALREADY ON — the library's one per-learner fact.
//
// The enrollment lives in IndexedDB (written once by `commitOnboarding`), so it
// can only be read on the client. The library page itself is a SERVER component
// and must stay one: the offered set is build-time data, and an RSC that read
// the log would paint "not enrolled" during SSR and flip after hydration, which
// is edge case #72 exactly. So this read is a separate island, in the shape
// `components/session/SessionGate.tsx` established.
//
// ---------------------------------------------------------------------------
// WHY THIS NAMES THE ENROLLMENT INSTEAD OF MARKING A ROW
// ---------------------------------------------------------------------------
// The obvious design is a "current" badge on the enrolled row. That would make
// the server-rendered list depend on a client read — the list would render
// unmarked, then a row would sprout a badge — so the marker stands beside the
// list and names the surah instead. Same fact, no flicker, and the list stays
// a pure function of build-time data.
//
// ---------------------------------------------------------------------------
// WHY IT DOES NOT OFFER TO SWITCH
// ---------------------------------------------------------------------------
// `meta.onboardingChoices.surah` is a SINGLE number and it is what
// `SessionGate` reads to decide what /session drills. There is no enrollment
// store, no enroll/unenroll event type, and no outbox row for such a change.
// A "switch to this surah" control here would therefore silently change what
// the learner is drilling with no event, no undo and nothing for sync to
// reconcile — and `commitOnboarding` is documented as the ONE writer, whose
// write ORDER is load-bearing. So this island READS and never writes. Real
// multi-surah enrollment is build-plan step 6/30 and needs an event type first.
//
// SKELETONS ARE NEVER ZEROS (#73): `pending` paints a skeleton, never the
// sentence "you have not started a surah" — telling an enrolled learner they
// have nothing while the read is still in flight is the same class of lie as
// painting 0 due.

import { useEffect, useState } from "react";

import { readChoices } from "@/lib/onboarding/choices";
import { OFFERED_SURAHS, surahLabel } from "@/lib/onboarding/surahs";

type State =
  | { kind: "pending" }
  | { kind: "none" }
  | { kind: "enrolled"; label: string }
  | { kind: "broken" };

export function EnrolledMarker() {
  const [state, setState] = useState<State>({ kind: "pending" });

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const choices = await readChoices();
        if (!alive) return;
        if (!choices || typeof choices.surah !== "number") {
          setState({ kind: "none" });
          return;
        }
        // The label comes from the offered list, so an enrollment in a surah
        // this build no longer offers degrades to the bare number rather than
        // rendering `undefined`.
        const offered = OFFERED_SURAHS.find((s) => s.surah === choices.surah);
        setState({
          kind: "enrolled",
          label: offered ? surahLabel(offered) : `Surah ${choices.surah}`,
        });
      } catch {
        // An unreadable store is not an empty store. Saying "you have not
        // started" to a learner whose database failed to open would be the
        // read failure masquerading as a fact about them.
        if (alive) setState({ kind: "broken" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  switch (state.kind) {
    case "pending":
      return (
        <p className="caption">
          <span className="skel" aria-hidden="true" />{" "}
          <span className="sr-only">Reading your enrollment…</span>
          reading your enrollment…
        </p>
      );

    case "none":
      return (
        <p className="caption">
          You have not started a surah on this device yet. Onboarding is where
          the first one is chosen.
        </p>
      );

    case "enrolled":
      return (
        <p className="caption">
          You are currently learning <strong>{state.label}</strong>. Adding a
          second surah is not built yet.
        </p>
      );

    case "broken":
      return (
        <p className="caption">
          Your enrollment could not be read on this device. Nothing has been
          lost — the log is append-only and re-readable once storage recovers.
        </p>
      );
  }
}
