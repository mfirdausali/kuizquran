// §18 SECTION 6 — PROOF WITHOUT USERS.
//
// Cited science, a builder's note, and the open build log. NO TESTIMONIALS —
// §18: "No fake testimonials, ever."
//
// Each citation names its source so a sceptical reader can go and check it,
// which is the entire difference between a citation and an appeal to authority.
//
// Saying ON THE PAGE that there are no testimonials is stronger than merely
// having none: a visitor cannot otherwise tell a page with none YET from a page
// that will never invent them.

import { Section, SectionHeading } from "@/components/ui/Container";
import type { LandingDictionary } from "@/lib/i18n/dictionaries";

export function Proof({ dict }: { dict: LandingDictionary }) {
  return (
    <Section id="proof">
      <SectionHeading id="proof">{dict.proof.heading}</SectionHeading>
      <p className="landing-lead">{dict.proof.intro}</p>
      <ul className="landing-cites">
        {dict.proof.citations.map((c) => (
          <li key={c.source}>
            <span className="landing-cite-source">{c.source}</span>
            <span className="landing-body">{c.claim}</span>
          </li>
        ))}
      </ul>
      <div className="card">
        <div className="card-header">
          <span>{dict.proof.buildLog}</span>
        </div>
        <p className="landing-body">{dict.proof.buildersNote}</p>
      </div>
      <p className="caption">{dict.proof.noTestimonials}</p>
    </Section>
  );
}
