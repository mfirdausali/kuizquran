// "/" — THE LANDING PAGE (build-plan step 29, WIREFRAME §18; v3-D14).
//
//   "/" = landing, stateless. "/home" = dashboard. They are different pages
//   with different audiences and they never collide.
//
// This is a SERVER COMPONENT and it stays one. It reads no IndexedDB (a
// landing page has no learner), imports no engine, and holds no state — which
// is what lets it be cached and served instantly, including by the service
// worker while offline. The ONLY client JS is two islands: <OnboardedSteer/>,
// which renders nothing and redirects an already-onboarded learner to /home
// (see that file for why middleware cannot do this job alone), and
// <InlineDemo/>, the drill.
//
// It has no tab bar, because it is outside the (app) route group. Showing
// learner navigation to a visitor who has not started would be a lie about
// what they have.
//
// ---------------------------------------------------------------------------
// EIGHT SECTIONS, IN §18'S ORDER
// ---------------------------------------------------------------------------
//   1 hero · 2 INTERACTIVE DEMO · 3 the mechanism · 4 the plan · 5 objections
//   6 proof without users · 7 pricing · 8 footer
//
// The order is asserted from `SECTION_ORDER`, not from the sequence these
// elements happen to appear in. §18 contemplates an A/B test moving the demo
// above or below the mechanism section, and when that happens it should be one
// edit to a named constant rather than a silent reshuffle of markup that no
// test notices.
//
// ---------------------------------------------------------------------------
// THE DEMO IS THE PAGE. EVERYTHING ELSE IS SUPPORT.
// ---------------------------------------------------------------------------
// §18: "The demo is the conversion engine. The mechanic sells itself;
// describing it does not." So it sits second — after one headline and before
// any argument — and it is the REAL drill: the same `SequenceFillCard` a
// paying learner taps, driven by the engine's own `reconstruct.ts`, over the
// compiled corpus. Not a video, not a GIF, not a mock. A visitor can finish it
// before deciding to read a single further word.
//
// ---------------------------------------------------------------------------
// WHY THERE IS NO PROSE IN THIS FILE
// ---------------------------------------------------------------------------
// Every sentence comes from `lib/landing/copy.ts`. That is what makes v3-D19
// ("no landing string claims to teach tajwid or replace a teacher")
// mechanically checkable: the strings are DATA, `findClaims` scans them in a
// test AND in the boundaries gate, and clause 12 forbids raw prose from
// reappearing in this markup — because a claim written directly into JSX would
// slip past a checker that only ever reads the copy module.
//
// ---------------------------------------------------------------------------
// PRE-RECALL SURFACE (gate clause 8)
// ---------------------------------------------------------------------------
// No email field. No notification prompt. No password. No account of any kind.
// WIREFRAME §17's governing rule is that recall comes before identity, and this
// page is the first thing a stranger sees — so the only thing it asks of them
// is a tap on a tile. The CTA leads INTO the drill, never into a form.
//
// The gate enforces the markup half; the honesty half is that the demo writes
// nothing at all (see lib/demo/reconstruct.ts).

import Link from "next/link";
import { OnboardedSteer } from "@/components/shell/OnboardedSteer";
import { InlineDemo } from "@/components/demo/InlineDemo";
import { PricingPanel } from "@/components/landing/PricingPanel";
import {
  DEMO,
  FOOTER,
  HERO,
  MECHANISM,
  OBJECTIONS,
  PLAN,
  PRICING_COPY,
  PROOF,
  SECTION_ORDER,
  type LandingSectionId,
} from "@/lib/landing/copy";

/** Where the CTA goes. Onboarding (§17) is build-plan step 22 and owns "/start";
 *  until it exists this points at the dashboard, which is where a curious
 *  visitor can see the shell and an onboarded one belongs. Named once so the
 *  swap is a one-line edit in a single place. */
const CTA_HREF = "/home";

function Cta({ variant }: { variant: "primary" | "ghost" }) {
  return (
    <Link
      href={CTA_HREF}
      className={`btn ${variant === "primary" ? "btn--primary" : "btn--ghost"} hit`}
      role="button"
      data-cta={variant}
    >
      {HERO.cta}
    </Link>
  );
}

/** One section, rendered by id. A switch rather than eight inlined blocks, so
 *  SECTION_ORDER genuinely DRIVES the page: reordering the constant reorders
 *  the page, and a section added to the union without a case here is a compile
 *  error (the `never` at the bottom), never a section silently missing. */
function Section({ id }: { id: LandingSectionId }) {
  switch (id) {
    case "hero":
      return (
        <header className="landing-hero" id="hero">
          <h1 className="landing-h1">{HERO.headline}</h1>
          <p className="voice">{HERO.subhead}</p>
          <Cta variant="primary" />
          <p className="caption">{HERO.ctaNote}</p>
        </header>
      );

    case "demo":
      // SECOND on the page, deliberately. §18: the demo is the conversion
      // engine and the mechanic sells itself.
      return (
        <section className="landing-section" id="demo" aria-labelledby="demo-h">
          <h2 id="demo-h" className="landing-h2">
            {DEMO.heading}
          </h2>
          <p className="landing-lead">{DEMO.intro}</p>
          <InlineDemo
            label="Al-Ikhlas, verse 1"
            onDone={
              <>
                <p className="caption">{DEMO.afterNote}</p>
                <Cta variant="primary" />
              </>
            }
          />
        </section>
      );

    case "mechanism":
      return (
        <section className="landing-section" id="mechanism" aria-labelledby="mechanism-h">
          <h2 id="mechanism-h" className="landing-h2">
            {MECHANISM.heading}
          </h2>
          <p className="landing-lead">{MECHANISM.intro}</p>
          <div className="stack">
            {MECHANISM.points.map((point) => (
              <div className="card" key={point.heading}>
                <div className="card-header">
                  <span>{point.heading}</span>
                </div>
                <p className="landing-body">{point.body}</p>
              </div>
            ))}
          </div>
        </section>
      );

    case "plan":
      return (
        <section className="landing-section" id="plan" aria-labelledby="plan-h">
          <h2 id="plan-h" className="landing-h2">
            {PLAN.heading}
          </h2>
          <p className="landing-lead">{PLAN.body}</p>
          {/* §18 section 4 wants a calendar screenshot here. There is a real
              /plan surface (build-plan step 19) but no learner data on a
              landing page to render it from, and a SCREENSHOT OF A FABRICATED
              LEARNER'S CALENDAR is the same class of lie as a fake testimonial
              — it would show specific verses on specific days for a person who
              does not exist. So the promise is stated in words until there is
              a real one to show. Recorded as an honest gap, not hidden. */}
          <p className="landing-promise">{PLAN.promise}</p>
          <p className="caption">{PLAN.caveat}</p>
        </section>
      );

    case "objections":
      return (
        <section className="landing-section" id="objections" aria-labelledby="objections-h">
          <h2 id="objections-h" className="landing-h2">
            {OBJECTIONS.heading}
          </h2>
          <div className="stack">
            {OBJECTIONS.items.map((item) => (
              <div className="card" key={item.question}>
                <div className="card-header">
                  <span>{item.question}</span>
                </div>
                <p className="landing-body">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      );

    case "proof":
      return (
        <section className="landing-section" id="proof" aria-labelledby="proof-h">
          <h2 id="proof-h" className="landing-h2">
            {PROOF.heading}
          </h2>
          <p className="landing-lead">{PROOF.intro}</p>
          {/* CITED SCIENCE. Each entry names its source so a sceptical reader
              can go and check it — which is the entire difference between a
              citation and an appeal to authority. */}
          <ul className="landing-cites">
            {PROOF.citations.map((c) => (
              <li key={c.source}>
                <span className="landing-cite-source">{c.source}</span>
                <span className="landing-body">{c.claim}</span>
              </li>
            ))}
          </ul>
          <div className="card">
            <div className="card-header">
              <span>{PROOF.buildLog}</span>
            </div>
            <p className="landing-body">{PROOF.buildersNote}</p>
          </div>
          {/* §18 section 6: "No fake testimonials, ever." Saying so ON THE PAGE
              is stronger than merely not having any — a visitor cannot tell the
              difference between a page with no testimonials yet and a page that
              will never invent them. */}
          <p className="caption">{PROOF.noTestimonials}</p>
        </section>
      );

    case "pricing":
      return (
        <section className="landing-section" id="pricing" aria-labelledby="pricing-h">
          <h2 id="pricing-h" className="landing-h2">
            {PRICING_COPY.heading}
          </h2>
          <PricingPanel />
          <Cta variant="ghost" />
        </section>
      );

    case "footer":
      return (
        <footer className="landing-footer" id="footer">
          <p className="landing-ethics">{FOOTER.ethics}</p>
          <p className="caption">{FOOTER.customer}</p>
          {/* v3-D19's positioning, stated plainly in the footer so it reaches a
              visitor who skipped the objections. */}
          <p className="caption">{FOOTER.position}</p>
          {/* The attribution page (build-plan step 30, v3-D24: "ships
              regardless"). Linked from the footer of the one page every visitor
              sees, because an attribution page nobody can reach discharges no
              obligation. A short label, not prose — clause 12 forbids sentences
              in this markup, and the page's own copy lives in
              lib/legal/attribution.ts. */}
          <p className="caption">
            <Link href="/attribution" className="hit">
              Sources and attribution
            </Link>
          </p>
        </footer>
      );

    default: {
      // A ninth section id added to the union without a case here is a COMPILE
      // error naming it, never a section that quietly fails to render.
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export default function LandingPage() {
  return (
    <>
      <OnboardedSteer />
      <main className="screen landing" id="main">
        {SECTION_ORDER.map((id) => (
          <Section id={id} key={id} />
        ))}
      </main>
    </>
  );
}
