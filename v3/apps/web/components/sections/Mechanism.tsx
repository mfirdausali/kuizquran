// §18 SECTION 3 — THE MECHANISM.
// "Rebuild-don't-reread · the overnight gate · an honest number (half-life)."
// Three points, each backed by a real surface in the product.

import { Section, SectionHeading } from "@/components/ui/Container";
import type { LandingDictionary } from "@/lib/i18n/dictionaries";

export function Mechanism({ dict }: { dict: LandingDictionary }) {
  return (
    <Section id="mechanism">
      <SectionHeading id="mechanism">{dict.mechanism.heading}</SectionHeading>
      <p className="landing-lead">{dict.mechanism.intro}</p>
      <div className="stack">
        {dict.mechanism.points.map((point) => (
          <div className="card" key={point.heading}>
            <div className="card-header">
              <span>{point.heading}</span>
            </div>
            <p className="landing-body">{point.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
