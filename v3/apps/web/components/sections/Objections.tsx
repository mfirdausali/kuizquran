// §18 SECTION 5 — THE THREE OBJECTIONS.
//
// Each `question` is in the visitor's own voice — something they are already
// thinking — and never a strawman that is easy to knock down. See
// lib/landing/copy.ts#OBJECTIONS.

import { Section, SectionHeading } from "@/components/ui/Container";
import type { LandingDictionary } from "@/lib/i18n/dictionaries";

export function Objections({ dict }: { dict: LandingDictionary }) {
  return (
    <Section id="objections">
      <SectionHeading id="objections">{dict.objections.heading}</SectionHeading>
      <div className="stack">
        {dict.objections.items.map((item) => (
          <div className="card" key={item.question}>
            <div className="card-header">
              <span>{item.question}</span>
            </div>
            <p className="landing-body">{item.answer}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
