// THE CI PRICING CLAUSE, client side (edge case #196, v3-D07).
//
// Mirrors `v3/api/tests/Feature/Billing/PricingConstantsTest.php`. The two must
// agree — a client showing RM20 while the server charges RM25 is the failure that
// makes a learner distrust every other number in the product.

import { describe, expect, it } from "vitest";
import { DEFAULT_REGION, PRICING, TRIAL, formatPrice, regionFromCountry } from "../lib/pricing";

/** v3-D07, quoted so a failure names the decision it contradicts. */
const V3_D07 = [
  "v3-D07 — Hard paywall:",
  '  "Monthly:  RM20 (Malaysian IP) · USD10 (international)',
  '   Lifetime: RM500 (Malaysian IP) · USD200 (international)"',
].join("\n");

describe("v3-D07 pricing constants", () => {
  it("monthly is RM20 / USD10", () => {
    expect(PRICING.MY.monthly, V3_D07).toBe(2000);
    expect(PRICING.MY.currency, V3_D07).toBe("MYR");
    expect(PRICING.INTL.monthly, V3_D07).toBe(1000);
    expect(PRICING.INTL.currency, V3_D07).toBe("USD");
  });

  it("lifetime is RM500 / USD200", () => {
    expect(PRICING.MY.lifetime, V3_D07).toBe(50000);
    expect(PRICING.INTL.lifetime, V3_D07).toBe(20000);
  });

  it("trial is one surah or 14 days", () => {
    expect(TRIAL.surahs, V3_D07).toBe(1);
    expect(TRIAL.days, V3_D07).toBe(14);
  });

  it("every price is an integer in minor units (never a float)", () => {
    for (const region of ["MY", "INTL"] as const) {
      for (const plan of ["monthly", "lifetime"] as const) {
        expect(Number.isInteger(PRICING[region][plan])).toBe(true);
      }
    }
  });
});

describe("edge case #120 — FPX cannot recur", () => {
  it("monthly in MY is card-only, so the copy cannot lie", () => {
    expect(PRICING.MY.monthlyRails).toEqual(["card"]);
  });

  it("but a one-off lifetime purchase may use FPX or GrabPay", () => {
    expect(PRICING.MY.lifetimeRails).toContain("fpx");
    expect(PRICING.MY.lifetimeRails).toContain("grabpay");
  });
});

describe("edge case #119 — IP sets the DEFAULT only", () => {
  it("maps CF-IPCountry to a default region", () => {
    expect(regionFromCountry("MY")).toBe("MY");
    expect(regionFromCountry("my")).toBe("MY");
    expect(regionFromCountry("SG")).toBe("INTL");
    expect(regionFromCountry(null)).toBe(DEFAULT_REGION);
    expect(regionFromCountry(undefined)).toBe(DEFAULT_REGION);
  });
});

describe("formatPrice is the ONE place a price becomes text", () => {
  it("renders whole amounts without decimals", () => {
    expect(formatPrice(PRICING.MY.monthly, "MYR")).toBe("RM20");
    expect(formatPrice(PRICING.MY.lifetime, "MYR")).toBe("RM500");
    expect(formatPrice(PRICING.INTL.monthly, "USD")).toBe("USD10");
    expect(formatPrice(PRICING.INTL.lifetime, "USD")).toBe("USD200");
  });

  it("renders partial amounts with two decimals", () => {
    expect(formatPrice(1999, "MYR")).toBe("RM19.99");
  });
});
