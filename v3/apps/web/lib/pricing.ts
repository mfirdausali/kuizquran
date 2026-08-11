// THE ONE PLACE PRICES ARE WRITTEN ON THE CLIENT (edge case #196).
//
// Mirrors `v3/api/config/pricing.php`. `test/pricing.test.ts` asserts every value
// against v3-D07's text, and `check-boundaries.mjs` clause 10 fails the build on a
// price literal anywhere else — because a test over this file alone stays green
// while a template hardcodes the old price beside it.
//
// v3-D07, verbatim:
//
//   "A limited free trial (one surah, or 14 days), then payment is required to
//    continue.
//      Monthly:  RM20 (Malaysian IP) · USD10 (international)
//      Lifetime: RM500 (Malaysian IP) · USD200 (international)
//    IP sets the default region; the learner can change it. The chosen region is
//    stored on the account, not per session, so travelling never reprices anyone."
//
// Minor units (sen/cents), integers only. A float price is a rounding bug waiting
// for a specific total.

import type { Region } from "./entitlement/types";

export interface RegionPricing {
  readonly currency: "MYR" | "USD";
  readonly monthly: number;
  readonly lifetime: number;
  /** Edge case #120: FPX cannot recur, so monthly in MY is card-only at launch. */
  readonly monthlyRails: readonly string[];
  readonly lifetimeRails: readonly string[];
}

export const PRICING: Readonly<Record<Region, RegionPricing>> = {
  MY: {
    currency: "MYR",
    monthly: 2000, // RM20.00
    lifetime: 50000, // RM500.00
    monthlyRails: ["card"],
    lifetimeRails: ["card", "fpx", "grabpay"],
  },
  INTL: {
    currency: "USD",
    monthly: 1000, // USD10.00
    lifetime: 20000, // USD200.00
    monthlyRails: ["card"],
    lifetimeRails: ["card"],
  },
};

/** v3-D07: "a limited free trial (one surah, or 14 days)". */
export const TRIAL = { surahs: 1, days: 14 } as const;

/** Edge case #119: IP sets the DEFAULT only; the learner may change it, and the
 *  choice lives on the account so travelling never reprices anyone. */
export const DEFAULT_REGION: Region = "INTL";

export function regionFromCountry(cfIpCountry: string | null | undefined): Region {
  return cfIpCountry?.toUpperCase() === "MY" ? "MY" : DEFAULT_REGION;
}

/** Format a minor-unit amount for display. The ONLY place a price becomes text. */
export function formatPrice(minorUnits: number, currency: "MYR" | "USD"): string {
  const major = (minorUnits / 100).toFixed(minorUnits % 100 === 0 ? 0 : 2);
  return currency === "MYR" ? `RM${major}` : `USD${major}`;
}
