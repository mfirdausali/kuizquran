// THE OVERRIDE-FIELD MIRROR-AGREEMENT GUARD.
//
// The override layer's closed `field` set ("gloss" | "distractor" | "group" |
// "disable") used to be hand-declared FOUR separate times with no shared
// source: the TS type `OverrideField` (packages/engine/src/overrides.ts,
// type-only, erased at compile time), `apps/web/lib/overrides/fetch.ts`'s own
// runtime `CLOSED_FIELDS` array, `.../fetchServer.ts`'s own byte-identical
// copy of that same array, and `OverridesController::CLOSED_FIELDS` in
// Laravel — whose own comment already named the risk: "kept in sync by
// hand." The two TypeScript copies could simply be ONE copy, reached by
// import (the same move this build made for `OnboardedSteer.tsx`'s
// `ONBOARDED_AT`, v3-D312), since neither `fetch.ts` nor `fetchServer.ts` is
// barred from importing a plain data constant off `engine/overrides.ts` —
// both already import the TYPE from it. That duplication is now closed:
// both files import `OVERRIDE_FIELDS` from the engine instead of
// re-declaring it.
//
// The remaining half — the engine's `OVERRIDE_FIELDS` vs. the Laravel
// `OverridesController::CLOSED_FIELDS` — crosses a language boundary no
// import can reach, the identical "two implementations of one decision, no
// shared source" shape this build has repeatedly closed elsewhere
// (`cache-config-agreement.test.ts` v3-D150, `pricing-config-agreement
// .test.ts` v3-D158, `reveal-reason-codes-agreement.test.ts` v3-D311,
// `LaunchSurahsAgreementTest.php` v3-D296). This test is the mechanical
// link for that half: it reads `OverridesController.php`'s raw source text
// (the same `readFileSync` + regex-extract technique those precedents
// already use) and asserts the parsed `CLOSED_FIELDS` array is exactly the
// same SET as `OVERRIDE_FIELDS` — same members, no stray, none missing,
// either direction.
//
// Not a live divergence today — all declarations already agree — a
// drift-risk fix: a future field added to (or retired from) one side alone
// would silently desync what the client is willing to send from what the
// server actually accepts, with nothing to catch it.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OVERRIDE_FIELDS } from "@engine/overrides.ts";

const OVERRIDES_CONTROLLER_PATH = path.resolve(
  __dirname,
  "../../../../api/app/Http/Controllers/OverridesController.php",
);

function parsePhpClosedFields(source: string): string[] {
  const block = source.match(/CLOSED_FIELDS\s*=\s*\[([^\]]*)\]/s)?.[1];
  if (block === undefined) {
    throw new Error("Could not find CLOSED_FIELDS in OverridesController.php's own source.");
  }
  const fields = [...block.matchAll(/'([a-z_]+)'/g)]
    .map((m) => m[1])
    .filter((f): f is string => typeof f === "string");
  if (fields.length === 0) {
    throw new Error("CLOSED_FIELDS block matched but no quoted string literals were found.");
  }
  return fields;
}

describe("OVERRIDE_FIELDS agrees with OverridesController::CLOSED_FIELDS", () => {
  it("is the exact same set as the server's closed set, no stray, none missing", () => {
    const phpSource = readFileSync(OVERRIDES_CONTROLLER_PATH, "utf8");
    const serverFields = parsePhpClosedFields(phpSource);

    expect(new Set(OVERRIDE_FIELDS)).toEqual(new Set(serverFields));
    // Also pin the count, so a duplicate on either side (which a bare Set
    // comparison would silently absorb) still fails this test.
    expect(OVERRIDE_FIELDS.length).toBe(serverFields.length);
  });
});
