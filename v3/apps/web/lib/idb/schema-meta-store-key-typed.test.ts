// `Iq3Schema`'s own `meta` store declares `value: MetaRow`, whose own `key`
// field is the carefully-documented closed union `MetaKey` (eleven members,
// each with its own paragraph explaining why it exists). But the STORE's own
// declared KEY type — what `idb`'s typed `get`/`delete`/`getKey` actually
// check a lookup key against — was `string`, not `MetaKey`:
//
//     meta: { key: string; value: MetaRow };
//
// `MetaRow.key: MetaKey` only protects a `put()` call, where the explicit
// object literal's own `key` field is checked structurally. Every OTHER call
// site in this app — `db.get("meta", "writerId")`, `db.get("meta",
// ONBOARDED_AT)`, `db.get("meta", ENTITLEMENT_SNAPSHOT_KEY)`, and seven more
// like them across `writeLock.ts`/`append.ts`/`read.ts`/`cursor.ts`/
// `choices.ts`/`entitlement/sync.ts` — passes the key as the SECOND
// ARGUMENT to `get`, whose type comes from the schema's own declared `key`,
// not from `MetaRow`. With that declared as plain `string`, a typo'd meta
// key (e.g. `db.get("meta", "deviecId")`) type-checks fine and silently
// returns `undefined` forever at runtime — the exact "a typo'd second
// spelling of that key would silently strand every returning learner" risk
// `MetaKey`'s own docblock already warns about, left unguarded at the one
// place it would actually bite: the read/delete side, not the write side.
//
// Same technique `lib/macro/facts-agreement.test.ts` (v3-D137) and
// `lib/idb/schema-billing-agreement.test.ts` (v3-D264) already established:
// the guard is a TYPE, checked by `tsc --noEmit` (`make test`'s
// `typecheck-v3` step, which runs before vitest) — the `it()` block exists
// only so the guard is a counted, running test rather than an unreferenced
// type.

import { describe, expect, it } from "vitest";
import type { StoreKey } from "idb";
import type { Iq3Schema, MetaKey } from "./schema.ts";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? true
  : false;

// If `Equal<...>` is ever `false`, this line fails to compile — the type
// argument violates the `extends true` constraint — at THIS line, naming the
// real declared store-key type, rather than surfacing later as a get() that
// quietly accepts any string and returns `undefined` with no error anywhere.
type AssertKeysAgree<T extends true> = T;
type _MetaStoreKeyIsMetaKey = AssertKeysAgree<Equal<StoreKey<Iq3Schema, "meta">, MetaKey>>;

describe("Iq3Schema['meta'] store key is typed MetaKey, not plain string", () => {
  it("compiles only when the meta store's own declared key type is MetaKey", () => {
    // The real guard is the type-level `_MetaStoreKeyIsMetaKey` above,
    // enforced by `tsc --noEmit`. This assertion exists only so the guard is
    // a counted, running test rather than a type nobody ever references.
    const guardCompiled: true = true;
    expect(guardCompiled).toBe(true);
  });
});
