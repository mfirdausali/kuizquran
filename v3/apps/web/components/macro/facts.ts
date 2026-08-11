// The MacroFacts contract, as the UI sees it.
//
// This is a STRUCTURAL MIRROR of corpus-compiler/src/macro.ts's emission —
// the compiler decides, the UI looks up. It is re-declared here rather than
// imported because the web app depends on the ENGINE package, not on the
// build-time compiler; importing the compiler into a client bundle would ship
// the classifier (and its thresholds) to the browser, which is the exact
// arrangement §A.1 rejects.
//
// The test suite asserts these two declarations stay in agreement, so the
// mirror cannot drift silently.

/** v3-D21's four archetypes, as a literal string. The UI's only operation on
 *  it is a lookup — never a comparison, never a threshold. */
export type MacroArchetype = "ATOMIC" | "RING" | "LITANY" | "ARC";

/** Edge case #89's geometry choice, decided at build time. */
export type MacroLayout = "arc" | "strip";

export interface MacroRingSegment {
  from: number;
  to: number;
  label: string | null;
}

export interface MacroArcBeat {
  from: number;
  to: number;
  label: string;
  derived: boolean;
}

export interface MacroFacts {
  archetype: MacroArchetype;
  reason: string;
  layout: MacroLayout;
  /** False => the panel MUST show a visible "derived, not authored" label.
   *  Edge case #22 puts ARC's authored beats in M9; until then the structure
   *  is a derived partition and saying otherwise would be the structural
   *  version of the dishonest number WIREFRAME §10 forbids. */
  authored: boolean;
  ring?: { rukuCount: number; segments: MacroRingSegment[] };
  litany?: { refrainAyat: number[]; rhymeShare: number; rhymeLabel: string };
  arc?: { beats: MacroArcBeat[] };
}
