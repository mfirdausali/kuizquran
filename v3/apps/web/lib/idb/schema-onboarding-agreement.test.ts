// `lib/idb/schema.ts`'s own docblock on `MetaRecordValue` claimed: "the
// authoritative `OnboardingChoices` type... is assigned into this slot, so a
// drift between the two is a type error at the write site rather than a
// surprise at the read site." That claim is only half true, the exact shape
// v3-D264 already caught and fixed for this file's own sibling
// `BillingSnapshotRecord`, one interface below: `lib/onboarding/choices.ts
// #commitOnboarding` assigns a VARIABLE of type `OnboardingChoices` into the
// slot (`tx.store.put({ key: CHOICES, value: choices })`), not an inline
// object literal, so TypeScript's excess-property check never fires — an
// object with MORE fields than `MetaRecordValue` declares is always
// structurally assignable to it. That direction (`OnboardingChoices` losing a
// field `MetaRecordValue` still expects) is genuinely caught; the OTHER
// direction (`OnboardingChoices` gaining a field `MetaRecordValue` never
// mirrors) is not. `readChoices()`'s own `return value as OnboardingChoices`
// is a blind, unchecked cast — the same shape `readEntitlementSnapshot()` had
// at v3-D189, which is exactly how that drift went undetected.
//
// `MetaRecordValue` is DELIBERATELY a widened structural mirror (this file is
// a leaf module with no dependency on `lib/onboarding/choices.ts`, per its own
// header) — its field TYPES are intentionally looser (`string` instead of the
// closed unions `GlossLang`/`PaceMode`, a `{kind:string,...}` shape instead of
// the closed union `PlacementOutcome`), so a full structural-equality check
// (the `lib/macro/facts-agreement.test.ts` template) would fail for a reason
// that is correct by design, not a real drift. What must never drift is the
// FIELD SET — so this guard compares `keyof` on both sides instead, the same
// technique `lib/idb/schema-billing-agreement.test.ts` (v3-D264) already
// established for the sibling interface.

import { describe, expect, it } from "vitest";
import type { OnboardingChoices } from "../onboarding/choices.ts";
import type { MetaRecordValue } from "./schema.ts";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? true
  : false;

// If `Equal<...>` is ever `false`, this line fails to compile — the type
// argument violates the `extends true` constraint — at THIS line, naming both
// declarations, rather than surfacing later as a silently-dropped field in
// IndexedDB with no error anywhere.
type AssertKeysAgree<T extends true> = T;
type _OnboardingChoicesKeysAgreement = AssertKeysAgree<
  Equal<keyof OnboardingChoices, keyof MetaRecordValue>
>;

describe("MetaRecordValue field-set agreement (closing schema.ts's own overclaim)", () => {
  it("compiles only when MetaRecordValue mirrors every OnboardingChoices field", () => {
    // The real guard is the type-level `_OnboardingChoicesKeysAgreement`
    // above, enforced by `tsc --noEmit`. This assertion exists only so the
    // guard is a counted, running test rather than a type nobody references.
    const guardCompiled: true = true;
    expect(guardCompiled).toBe(true);
  });
});
