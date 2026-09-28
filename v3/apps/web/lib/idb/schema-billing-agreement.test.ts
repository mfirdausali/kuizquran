// `lib/idb/schema.ts`'s own docblock on `BillingSnapshotRecord` claims: "the
// authoritative `EntitlementSnapshot` type (in `lib/entitlement/types.ts`) is
// assigned into this slot at the write site, so a drift between the two is a
// type error there rather than a surprise at the read site." That claim is
// only half true: `lib/entitlement/sync.ts#writeEntitlementSnapshot` assigns
// a VARIABLE of type `EntitlementSnapshot` into the slot, not an inline
// object literal, so TypeScript's excess-property check never fires — an
// object with MORE fields than `BillingSnapshotRecord` declares is always
// structurally assignable to it. That direction (EntitlementSnapshot losing a
// field BillingSnapshotRecord still expects) is genuinely caught; the OTHER
// direction (EntitlementSnapshot gaining a field BillingSnapshotRecord never
// mirrors) is not — exactly what happened at v3-D189, when `currentPeriodEnd`/
// `graceUntil` were added to `EntitlementSnapshot` and never carried into
// `BillingSnapshotRecord`.
//
// `BillingSnapshotRecord` is DELIBERATELY a widened structural mirror (this
// file is a leaf module with no dependency on `lib/entitlement/*`, per its
// own header) — its field TYPES are intentionally looser (`string` instead of
// the closed union `EntitlementState`, etc.), so a full structural-equality
// check (the `lib/macro/facts-agreement.test.ts` template) would fail for a
// reason that is correct by design, not a real drift. What must never drift
// is the FIELD SET — so this guard compares `keyof` on both sides instead.
//
// Same technique `lib/macro/facts-agreement.test.ts` (v3-D137) established:
// the guard is a TYPE, checked by `tsc --noEmit` (`make test`'s
// `typecheck-v3` step, which runs before vitest) — the `it()` block exists
// only so the guard is a counted, running test rather than an unreferenced
// type.

import { describe, expect, it } from "vitest";
import type { EntitlementSnapshot } from "../entitlement/types.ts";
import type { BillingSnapshotRecord } from "./schema.ts";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? true
  : false;

// If `Equal<...>` is ever `false`, this line fails to compile — the type
// argument violates the `extends true` constraint — at THIS line, naming
// both declarations, rather than surfacing later as a silently-dropped field
// in IndexedDB with no error anywhere.
type AssertKeysAgree<T extends true> = T;
type _BillingSnapshotKeysAgreement = AssertKeysAgree<
  Equal<keyof EntitlementSnapshot, keyof BillingSnapshotRecord>
>;

describe("BillingSnapshotRecord field-set agreement (closing schema.ts's own overclaim)", () => {
  it("compiles only when BillingSnapshotRecord mirrors every EntitlementSnapshot field", () => {
    // The real guard is the type-level `_BillingSnapshotKeysAgreement` above,
    // enforced by `tsc --noEmit`. This assertion exists only so the guard is
    // a counted, running test rather than a type nobody ever references.
    const guardCompiled: true = true;
    expect(guardCompiled).toBe(true);
  });
});
