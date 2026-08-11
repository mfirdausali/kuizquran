// §18 SECTION 4 — THE PLAN.
//
// §18 wants a calendar screenshot here. There IS a real /plan surface
// (build-plan step 19), but there is no learner data on a landing page to
// render it from — and a SCREENSHOT OF A FABRICATED LEARNER'S CALENDAR is the
// same class of lie as a fake testimonial: it would show specific verses on
// specific days for a person who does not exist. So the promise is stated in
// words until there is a real one to show. Recorded as an honest gap, not
// hidden.

import { Section, SectionHeading } from "@/components/ui/Container";
import type { LandingDictionary } from "@/lib/i18n/dictionaries";

export function Plan({ dict }: { dict: LandingDictionary }) {
  return (
    <Section id="plan">
      <SectionHeading id="plan">{dict.plan.heading}</SectionHeading>
      <p className="landing-lead">{dict.plan.body}</p>
      <p className="landing-promise">{dict.plan.promise}</p>
      <p className="caption">{dict.plan.caveat}</p>
    </Section>
  );
}
