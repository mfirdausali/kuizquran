// `components/macro/facts.ts`'s own docblock claims: "The test suite asserts
// these two declarations stay in agreement, so the mirror cannot drift
// silently." v3-D136 grep-verified that claim FALSE — no such test existed
// anywhere. This file is that test.
//
// `MacroFacts` is erased at runtime (it's a TypeScript interface), so
// "stays in agreement" cannot be checked with a value-level `expect()` —
// there is nothing left to inspect once the file compiles to JS. The real
// assertion below is a TYPE, checked by `tsc --noEmit` (`make test`'s
// `typecheck-v3` step, which already runs across all of apps/web before
// vitest starts) — not by the `it()` block, which exists only so this guard
// shows up in `Tests N passed` and isn't tree-shaken as an unused import.
//
// Deliberately does NOT import `classify` (a VALUE) from the compiler —
// `components/macro/facts.ts`'s own header explains why that value must
// never reach the UI's client bundle (it would ship the classifier and its
// thresholds to the browser). A `type`-only import is erased entirely by
// `tsc`/`esbuild` and produces zero runtime bytes, so it carries none of
// that risk even though this file lives beside `lib/macro/facts.ts`, which
// DOES import the value (server-only, per that file's own header).

import { describe, expect, it } from "vitest";
import type { MacroFacts as CompilerMacroFacts } from "../../../../packages/corpus-compiler/src/macro.ts";
import type { MacroFacts as UIMacroFacts } from "@/components/macro/facts.ts";

// The standard "strict type equality" trick (distributive conditional
// invariance) — true only when A and B admit exactly the same set of
// assignable values, including matching optional/required modifiers on
// every field. A structural superset/subset relationship (one side gaining
// or losing a field, or a field's optionality changing) evaluates to false.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? true
  : false;

// If `Equal<...>` is ever `false`, this line fails to compile — the type
// argument violates the `extends true` constraint — at THIS line, in THIS
// file, naming both declarations, rather than surfacing later as a mysterious
// cast error wherever a `classify()` result meets the UI's `MacroFacts` type.
type AssertMacroFactsAgree<T extends true> = T;
type _MacroFactsMirrorAgreement = AssertMacroFactsAgree<Equal<CompilerMacroFacts, UIMacroFacts>>;

describe("MacroFacts mirror agreement (v3-D137, closing v3-D136's named gap)", () => {
  it("compiles only when the compiler's and the UI's MacroFacts declarations are structurally identical", () => {
    // The real guard is the type-level `_MacroFactsMirrorAgreement` above,
    // enforced by `tsc --noEmit`. This assertion exists only so the guard is
    // a counted, running test rather than a type nobody ever references.
    const guardCompiled: true = true;
    expect(guardCompiled).toBe(true);
  });
});
