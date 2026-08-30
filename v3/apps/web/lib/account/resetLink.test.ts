// `lib/account/resetLink.ts` — parses the `/reset-password?token=&email=`
// query string the emailed reset link carries (see
// `v3/api/app/Providers/AppServiceProvider.php`'s `ResetPassword::createUrlUsing`
// closure — the exact shape this module reads back). Mirrors
// `lib/drill/handoff.ts`/`lib/practice/handoff.ts`'s own convention: a
// hand-edited or absent query degrades to `null`, never a throw (edge case #78).

import { describe, expect, it } from "vitest";
import { parseResetLinkParams } from "./resetLink";

describe("parseResetLinkParams", () => {
  it("parses a real token+email pair", () => {
    expect(parseResetLinkParams({ token: "abc123", email: "learner@example.com" })).toEqual({
      token: "abc123",
      email: "learner@example.com",
    });
  });

  it("degrades to null when the token is missing", () => {
    expect(parseResetLinkParams({ email: "learner@example.com" })).toBeNull();
  });

  it("degrades to null when the email is missing", () => {
    expect(parseResetLinkParams({ token: "abc123" })).toBeNull();
  });

  it("degrades to null when both are missing (a bare /reset-password visit)", () => {
    expect(parseResetLinkParams({})).toBeNull();
  });

  it("degrades to null on an empty-string token or email, never treats it as present", () => {
    expect(parseResetLinkParams({ token: "", email: "learner@example.com" })).toBeNull();
    expect(parseResetLinkParams({ token: "abc123", email: "" })).toBeNull();
  });
});
