// The build-plan stub marker.
//
// Every route in the tree gets a REAL file with a REAL heading — never a 404
// and never an empty file — because a missing route is indistinguishable from
// a broken one, and an empty one is indistinguishable from a finished one.
// This component makes the difference legible on the page itself: what is
// waiting, and which build-plan step owns it.
//
// A Server Component. It has no state and reads nothing.

import type { ReactNode } from "react";

interface StubNoteProps {
  /** The build-plan step / milestone that fills this route in, e.g. "step 20 (M6)". */
  step: string;
  /** What lands here when that step runs. One sentence, plainly. */
  children: ReactNode;
}

export function StubNote({ step, children }: StubNoteProps) {
  return (
    <p className="stub-note">
      <strong>Not built yet — {step}.</strong> {children}
    </p>
  );
}
