// THE ADMIN-ROLE-VALUE MIRROR-AGREEMENT GUARD.
//
// `App\Models\AdminRole::ALL` (the server's own closed role set —
// `self::OPERATOR` | `self::QARI` | `self::MODERATOR`, the INNER gate
// `admin:grant-role` enforces — v3-D92) was hand-declared independently on
// the TypeScript side TWICE, with no shared source: `lib/admin/roles.ts`'s
// own module-private `ROLE_VALUES` (used only to validate a fetched role
// string) and `components/admin/AdminRolesPanel.tsx`'s own, byte-identical
// `ROLE_OPTIONS` (the role-filter dropdown's option list) — the identical
// "two implementations of one decision, no shared source" shape this build
// has repeatedly closed elsewhere, including on this exact TS-side-only
// half (`OnboardedSteer.tsx`'s `ONBOARDED_AT`, v3-D312;
// `engine/overrides.ts#OVERRIDE_FIELDS`, v3-D323). That half is now closed:
// `roles.ts` exports the one runtime array, `ADMIN_ROLE_VALUES`, and the
// panel imports it instead of re-declaring it.
//
// The remaining half — `ADMIN_ROLE_VALUES` vs. the Laravel
// `AdminRole::ALL` — crosses a language boundary no import can reach, the
// same shape `reveal-reason-codes-agreement.test.ts` (v3-D311) and
// `override-fields-agreement.test.ts` (v3-D323) already close for their own
// pairs. This test is the mechanical link: it reads `AdminRole.php`'s raw
// source text (the same `readFileSync` + regex-extract technique those
// precedents use) and asserts the parsed set of role VALUES — read off the
// `OPERATOR`/`QARI`/`MODERATOR` class constants themselves, since `ALL`
// references them as `self::OPERATOR` etc. rather than repeating their
// string values a second time — is exactly the same SET as
// `ADMIN_ROLE_VALUES`: same members, no stray, none missing, either
// direction.
//
// Not a live divergence today — all three declarations already agreed
// byte-for-byte — a drift-risk fix: a future role added to (or retired
// from) one side alone would silently desync what the admin console's own
// filter offers, or what the client treats as a well-formed role, from
// what the server's `admin:grant-role` command and `AdminRole::ALL` set
// actually mean, with nothing to catch it.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_ROLE_VALUES } from "./roles";

const ADMIN_ROLE_MODEL_PATH = path.resolve(__dirname, "../../../../api/app/Models/AdminRole.php");

function parsePhpRoleValues(source: string): string[] {
  const matches = [...source.matchAll(/public\s+const\s+[A-Z_]+\s*=\s*'([a-z_]+)';/g)]
    .map((m) => m[1])
    .filter((v): v is string => typeof v === "string");
  if (matches.length === 0) {
    throw new Error("Could not find any role value constants in AdminRole.php's own source.");
  }
  return matches;
}

describe("ADMIN_ROLE_VALUES agrees with AdminRole::ALL", () => {
  it("is the exact same set as the server's closed role set, no stray, none missing", () => {
    const phpSource = readFileSync(ADMIN_ROLE_MODEL_PATH, "utf8");
    const serverValues = parsePhpRoleValues(phpSource);

    expect(new Set(ADMIN_ROLE_VALUES)).toEqual(new Set(serverValues));
    // Also pin the count, so a duplicate on either side (which a bare Set
    // comparison would silently absorb) still fails this test.
    expect(ADMIN_ROLE_VALUES.length).toBe(serverValues.length);
  });
});
