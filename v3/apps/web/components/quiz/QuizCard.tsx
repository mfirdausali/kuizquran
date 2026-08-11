"use client";

// THE DISPATCHER. One switch, over `item.shape`, and over NOTHING ELSE.
//
// WIREFRAME §22: "four shapes, closed permanently." The closure is what makes
// this file small and keeps it small: a fifth question type is a new SPEC
// producing one of these four shapes, not a new branch here. If someone ever
// does need a fifth shape, that is a kernel change — `render.ts` gains a member
// and the `never` below stops compiling, which is the design.
//
// THE SWITCH IS EXHAUSTIVE BY TYPE, NOT BY VIGILANCE. The `default` arm assigns
// `item` to `never`. `RenderItem` is a discriminated union, so once the four
// known shapes are handled TypeScript narrows the residue to `never` and the
// assignment compiles. Add a fifth member to `render.ts` and this line becomes
// a compile error naming the shape nobody handled. That is a stronger guarantee
// than a runtime throw, because it fires at build time on the machine of
// whoever changed the contract — v3-D38's lesson, applied: a check that cannot
// fail is worse than no check, so this one is arranged so it CAN.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO. It does not choose which item to
// show, does not grade, does not touch strength or bands or the queue. It
// receives one RenderItem and picks the component matching its shape. Every
// engine decision arrived before this function was called — as DATA, which is
// what check-boundaries.mjs clause 5 exists to guarantee and what makes
// DEFECTS.md#B2 impossible by construction.

import type { RenderItem } from "@engine/render.ts";
import { ChoiceCard } from "./ChoiceCard";
import { SequenceFillCard } from "./SequenceFillCard";
import { OrderTilesCard } from "./OrderTilesCard";
import { LocateChoiceCard } from "./LocateChoiceCard";
import type { Reveal } from "./reveal";

export interface QuizCardProps {
  item: RenderItem;
  /**
   * Reports the LOGICAL index the learner tapped — an index into the item's own
   * options (or tiles, for `orderTiles`). Never a visual position (#81), never
   * a verdict: the caller commits this to the log and decides correctness
   * against the item's own `correctIndex` / `correctOrder`.
   */
  onAnswer: (index: number) => void;
  reveal?: Reveal;
  label?: string;
  /** `sequenceFill` only: positions already filled, from the committed log. */
  filled?: ReadonlyMap<number, string>;
  /** `locateChoice` only: surah number for "12:4" option labels. */
  surah?: number;
}

export function QuizCard({ item, onAnswer, reveal, label, filled, surah }: QuizCardProps) {
  switch (item.shape) {
    case "choice":
      return <ChoiceCard item={item} onAnswer={onAnswer} reveal={reveal} label={label} />;

    case "sequenceFill":
      return (
        <SequenceFillCard
          item={item}
          onAnswer={onAnswer}
          reveal={reveal}
          label={label}
          filled={filled}
        />
      );

    case "orderTiles":
      // `orderTiles` has no single `correctIndex`, so its reveal is a boolean:
      // the run is finished, show the key. The tap channel is the same
      // `onAnswer(logicalIndex)` every other shape uses — one contract out of
      // this dispatcher, so the session loop has one handler and not four.
      return (
        <OrderTilesCard
          item={item}
          onTap={onAnswer}
          reveal={reveal !== undefined}
          label={label}
        />
      );

    case "locateChoice":
      return (
        <LocateChoiceCard
          item={item}
          onAnswer={onAnswer}
          reveal={reveal}
          label={label}
          surah={surah}
        />
      );

    default: {
      // The exhaustiveness proof. See the header: a fifth shape breaks this
      // assignment at COMPILE time, naming itself in the error.
      const _exhaustive: never = item;
      return _exhaustive;
    }
  }
}
