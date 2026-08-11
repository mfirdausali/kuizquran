// §18 SECTION 7 — PRICING.
//
// Every number comes from `lib/pricing.ts` via `<PricingPanel/>`; not one price
// is typed here or in that panel (edge case #196 / boundaries clause 10).
//
// The CTA repeats in the GHOST variant. A second primary button competing with
// the hero's would make neither one the page's obvious next step.

import { PricingPanel } from "@/components/landing/PricingPanel";
import { Button } from "@/components/ui/Button";
import { Section, SectionHeading } from "@/components/ui/Container";
import type { LandingDictionary } from "@/lib/i18n/dictionaries";

export function Pricing({
  dict,
  ctaHref,
}: {
  dict: LandingDictionary;
  ctaHref: string;
}) {
  return (
    <Section id="pricing">
      <SectionHeading id="pricing">{dict.pricing.heading}</SectionHeading>
      <PricingPanel />
      <Button href={ctaHref} variant="ghost" data-cta="ghost">
        {dict.hero.cta}
      </Button>
    </Section>
  );
}
