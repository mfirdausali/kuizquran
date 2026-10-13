// THE REVEAL-REASON-CODE MIRROR-AGREEMENT GUARD.
//
// `App\Models\AdminAudit::REASON_CODES` (the server-enforced closed set for
// a Reveal-identity action's typed reason, edge case #149) and this
// package's own `lib/admin/reveal.ts#REVEAL_REASON_CODES` each declare the
// SAME five-member set independently, in two languages, with no shared
// import path between them. `reveal.ts`'s own docblock already claims
// agreement ("Mirrors `AdminAudit::REASON_CODES`") but nothing mechanically
// checked it — the identical "two implementations of one decision, no
// shared source" shape this build has repeatedly closed elsewhere
// (`cache-config-agreement.test.ts` v3-D150, `trial-config-agreement
// .test.ts` v3-D151, `pricing-config-agreement.test.ts` v3-D158,
// `LaunchSurahsAgreementTest.php` v3-D296, `nightlyWindow-countsAsGreen
// -agreement.test.ts` v3-D291, `nightlyWindow-resetsWindow-agreement
// .test.ts` v3-D299).
//
// Not a live divergence today — both copies already agree byte-for-byte —
// a drift-risk fix, matching every precedent above: a future edit adding or
// retiring a reason code on one side only would silently desync the
// picker's offered set from what the server actually accepts, with no test
// anywhere to catch it (`reveal.test.ts` only ever asserts that
// `revealIdentity()` posts whatever `reasonCode` string it is given, never
// that the OFFERED set agrees with the server's closed set).
//
// This test is the mechanical link: it reads the PHP model's raw source
// text (the same `readFileSync` + regex-extract technique
// `pricing-config-agreement.test.ts` already uses to scan PHP source from a
// vitest test) and asserts the parsed `REASON_CODES` array is exactly the
// same SET as `REVEAL_REASON_CODES` — same members, no stray, none missing,
// either direction.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REVEAL_REASON_CODES } from "./reveal";

const ADMIN_AUDIT_MODEL_PATH = path.resolve(
  __dirname,
  "../../../../api/app/Models/AdminAudit.php",
);

function parsePhpReasonCodes(source: string): string[] {
  const block = source.match(/REASON_CODES\s*=\s*\[([^\]]*)\]/s)?.[1];
  if (block === undefined) {
    throw new Error("Could not find REASON_CODES in AdminAudit.php's own source.");
  }
  const codes = [...block.matchAll(/'([a-z_]+)'/g)]
    .map((m) => m[1])
    .filter((c): c is string => typeof c === "string");
  if (codes.length === 0) {
    throw new Error("REASON_CODES block matched but no quoted string literals were found.");
  }
  return codes;
}

describe("REVEAL_REASON_CODES agrees with AdminAudit::REASON_CODES", () => {
  it("is the exact same set as the server's closed set, no stray, none missing", () => {
    const phpSource = readFileSync(ADMIN_AUDIT_MODEL_PATH, "utf8");
    const serverCodes = parsePhpReasonCodes(phpSource);

    expect(new Set(REVEAL_REASON_CODES)).toEqual(new Set(serverCodes));
    // Also pin the count, so a duplicate on either side (which a bare Set
    // comparison would silently absorb) still fails this test.
    expect(REVEAL_REASON_CODES.length).toBe(serverCodes.length);
  });
});
