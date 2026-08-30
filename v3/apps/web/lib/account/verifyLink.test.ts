// `lib/account/verifyLink.ts` — parses the
// `/verify-email?id=&hash=&expires=&signature=` query string the emailed
// verification link carries (see
// `v3/api/app/Providers/AppServiceProvider.php`'s `VerifyEmail::createUrlUsing`
// closure — the exact shape this module reads back). Mirrors
// `lib/account/resetLink.test.ts`'s own convention: a hand-edited or absent
// query degrades to `null`, never a throw (edge case #78).

import { describe, expect, it } from "vitest";
import { parseVerifyLinkParams } from "./verifyLink";

describe("parseVerifyLinkParams", () => {
  it("parses a real id+hash+expires+signature quadruple", () => {
    expect(
      parseVerifyLinkParams({ id: "42", hash: "abc123hash", expires: "1780000000", signature: "deadbeef" }),
    ).toEqual({ id: "42", hash: "abc123hash", expires: "1780000000", signature: "deadbeef" });
  });

  it("degrades to null when the id is missing", () => {
    expect(parseVerifyLinkParams({ hash: "abc123hash", expires: "1780000000", signature: "deadbeef" })).toBeNull();
  });

  it("degrades to null when the hash is missing", () => {
    expect(parseVerifyLinkParams({ id: "42", expires: "1780000000", signature: "deadbeef" })).toBeNull();
  });

  it("degrades to null when expires is missing", () => {
    expect(parseVerifyLinkParams({ id: "42", hash: "abc123hash", signature: "deadbeef" })).toBeNull();
  });

  it("degrades to null when the signature is missing", () => {
    expect(parseVerifyLinkParams({ id: "42", hash: "abc123hash", expires: "1780000000" })).toBeNull();
  });

  it("degrades to null when everything is missing (a bare /verify-email visit)", () => {
    expect(parseVerifyLinkParams({})).toBeNull();
  });

  it("degrades to null on an empty-string field, never treats it as present", () => {
    expect(
      parseVerifyLinkParams({ id: "", hash: "abc123hash", expires: "1780000000", signature: "deadbeef" }),
    ).toBeNull();
    expect(
      parseVerifyLinkParams({ id: "42", hash: "", expires: "1780000000", signature: "deadbeef" }),
    ).toBeNull();
    expect(parseVerifyLinkParams({ id: "42", hash: "abc123hash", expires: "", signature: "deadbeef" })).toBeNull();
    expect(parseVerifyLinkParams({ id: "42", hash: "abc123hash", expires: "1780000000", signature: "" })).toBeNull();
  });
});
