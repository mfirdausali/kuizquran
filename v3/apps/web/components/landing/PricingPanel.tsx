// THE PRICING PANEL — v3-D07, rendered from `lib/pricing.ts` and nowhere else.
//
// ---------------------------------------------------------------------------
// NOT ONE PRICE IS TYPED IN THIS FILE
// ---------------------------------------------------------------------------
// Edge case #196 / check-boundaries clause 10: prices live in `lib/pricing.ts`
// and become text ONLY through `formatPrice`. This component reads the
// constants and formats them. A hardcoded "RM20" here would fail the build,
// which is exactly the failure the clause exists to produce — the pricing test
// alone would stay green while this template quietly lied.
//
// ---------------------------------------------------------------------------
// WHY BOTH REGIONS ARE SHOWN, RATHER THAN ONE DETECTED REGION
// ---------------------------------------------------------------------------
// v3-D07: "IP sets the default region; the learner can change it." IP-based
// detection belongs at CHECKOUT, on an account that can store the choice. On a
// static marketing page there is no account to store anything on, and geo-
// detecting a visitor to show them one price would (a) require this page to
// stop being cacheable, and (b) hide from a Malaysian expatriate that the
// USD tier exists at all — which is the segment v3-D07 explicitly refuses to
// shut out.
//
// So both are on the page, labelled, with the sentence saying the choice is
// theirs. That is also the only version of this panel that cannot be accused
// of price discrimination by stealth.
//
// ---------------------------------------------------------------------------
// THE RAILS NOTE IS NOT A DETAIL
// ---------------------------------------------------------------------------
// Edge case #120: FPX cannot recur, so monthly in Malaysia is card-only. A
// page that advertised FPX beside a monthly plan would be making a promise the
// payment rail cannot keep, and the learner would discover it at the worst
// possible moment. `monthlyRails` / `lifetimeRails` are read from the same
// constants the checkout will read.

import { PRICING, TRIAL, formatPrice } from "@/lib/pricing";
import { PRICING_COPY } from "@/lib/landing/copy";

/** Payment rail names, for display. The RAILS themselves come from the pricing
 *  constants; this is only how each is spelled on screen. */
const RAIL_LABEL: Readonly<Record<string, string>> = {
  card: "card",
  fpx: "FPX",
  grabpay: "GrabPay",
};

function rails(list: readonly string[]): string {
  return list.map((r) => RAIL_LABEL[r] ?? r).join(", ");
}

export function PricingPanel() {
  return (
    <div className="stack">
      {/* The trial line. `TRIAL` is the same constant the entitlement gate
          reads, so the offer on the page and the offer in the code are one
          fact. The numerals are interpolated, never typed. */}
      <p className="landing-lead">
        {PRICING_COPY.trial.replace("one surah", `${TRIAL.surahs} surah`).replace(
          "fourteen days",
          `${TRIAL.days} days`,
        )}
      </p>

      <div className="price-grid">
        {(
          [
            ["MY", "Malaysia"],
            ["INTL", "Everywhere else"],
          ] as const
        ).map(([region, regionLabel]) => {
          const p = PRICING[region];
          return (
            <div className="card price-card" key={region}>
              <div className="card-header">
                <span>{regionLabel}</span>
              </div>
              <p className="price-row">
                <span className="price-plan">{PRICING_COPY.monthlyLabel}</span>
                <span className="price-amount">{formatPrice(p.monthly, p.currency)}</span>
                <span className="price-per">a month</span>
              </p>
              <p className="caption price-rails">{rails(p.monthlyRails)}</p>
              <p className="price-row">
                <span className="price-plan">{PRICING_COPY.lifetimeLabel}</span>
                <span className="price-amount">{formatPrice(p.lifetime, p.currency)}</span>
                <span className="price-per">once</span>
              </p>
              <p className="caption price-rails">{rails(p.lifetimeRails)}</p>
            </div>
          );
        })}
      </div>

      <p className="caption">{PRICING_COPY.regionNote}</p>
      <p className="caption">{PRICING_COPY.lifetimeNote}</p>

      {/* v3-D07's one ethical obligation. Deliberately in the OK banner and not
          a caption: it is the most important sentence in this section, and the
          thing a learner is most afraid of when a memorization app mentions
          money. Teal, never coral — nothing has slipped (locked §8 rule 2). */}
      <div className="banner banner--ok">
        <p>{PRICING_COPY.neverHostage}</p>
      </div>
    </div>
  );
}
