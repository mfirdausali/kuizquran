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
// <InlineDemo/>, the drill, mounted by the demo section.
//
// It has no tab bar, because it is outside the (app) route group. Showing
// learner navigation to a visitor who has not started would be a lie about
// what they have.
//
// ---------------------------------------------------------------------------
// THIS FILE IS A COMPOSITION ROOT
// ---------------------------------------------------------------------------
// The five ARGUMENT sections — mechanism, plan, objections, proof, pricing —
// each live in their own module under `components/sections/`. What remains
// here is the ORDER and the WIRING: which section renders, in which sequence,
// with which dictionary and which CTA target.
//
// THREE SECTIONS STAY INLINE, AND THE REASON IS NOT TASTE. The reference
// project this structure comes from has a composition root that is a pure list
// of imports, and that is the better shape when nothing depends on the root's
// contents. Here three things do:
//
//   - HERO carries the page's only `<h1>`, and `test/shell.test.ts` asserts
//     every route file has a real top-level heading. That test is checking
//     "this route is not an empty stub", which is a property of the ROUTE, so
//     the evidence belongs in the route's file.
//   - DEMO's `<InlineDemo/>` import is asserted by `test/landing-page.test.tsx`
//     to come from the neutral `components/demo/` directory — the check that
//     the landing surface and §17's onboarding screen have not forked into two
//     copies of the drill. An indirection through a section module would leave
//     that assertion reading a file that no longer names the import.
//   - FOOTER's `/attribution` link is asserted by `test/attribution.test.tsx`,
//     because an attribution page linked from nowhere discharges no obligation
//     (v3-D24).
//
// Each of those three tests verifies a fact about THE PAGE. Moving the evidence
// into a module the test does not read would leave the fact true today and
// unguarded tomorrow — the assertion would pass against whatever the root
// happened to contain, having quietly stopped checking the thing it names. That
// is this build's documented failure mode and it is not worth a tidier import
// list. The five sections with no such tie moved out; these three did not.
//
// The switch is not ceremony. It is what makes `SECTION_ORDER` genuinely DRIVE
// the page rather than merely describe it:
//
//   - reordering the constant reorders the page, so §18's contemplated A/B
//     test (moving the demo above or below the mechanism) is a one-line edit
//     to a named constant instead of a silent reshuffle of markup that no test
//     would notice;
//   - a section id added to the union without a case here is a COMPILE ERROR
//     naming it (the `never` at the bottom), never a section that quietly
//     fails to render.
//
// ---------------------------------------------------------------------------
// EIGHT SECTIONS, IN §18'S ORDER
// ---------------------------------------------------------------------------
//   1 hero · 2 INTERACTIVE DEMO · 3 the mechanism · 4 the plan · 5 objections
//   6 proof without users · 7 pricing · 8 footer
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
// WHY THERE IS NO PROSE IN THIS FILE — OR IN ANY SECTION
// ---------------------------------------------------------------------------
// Every sentence comes from `lib/landing/copy.ts`, reached through
// `lib/i18n/dictionaries.ts`. That is what makes v3-D19 ("no landing string
// claims to teach tajwid or replace a teacher") mechanically checkable: the
// strings are DATA, `findClaims` scans them in a test AND in the boundaries
// gate, and clause 12 forbids raw prose from reappearing in this markup —
// because a claim written directly into JSX would slip past a checker that
// only ever reads the copy module.
//
// The dictionary layer holds NO strings of its own; it re-exports the copy
// module's constants. So extracting the sections did not create a second place
// prose can live, and both halves of the v3-D19 check still cover every
// sentence that ships. Clause 11's scope and clause 12's LANDING_MARKUP list
// were widened to `components/sections/` in the same change, so a sentence
// typed into a section file fails the build exactly as one typed here does.
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
import { Mechanism } from "@/components/sections/Mechanism";
import { Objections } from "@/components/sections/Objections";
import { Plan } from "@/components/sections/Plan";
import { Pricing } from "@/components/sections/Pricing";
import { Proof } from "@/components/sections/Proof";
import { Button } from "@/components/ui/Button";
import { Section as SectionShell, SectionHeading } from "@/components/ui/Container";
import { getDictionary, type LandingDictionary } from "@/lib/i18n/dictionaries";
import { SECTION_ORDER, type LandingSectionId } from "@/lib/landing/copy";

/** Where the CTA goes. Onboarding (§17) is build-plan step 22 and owns "/start";
 *  until it exists this points at the dashboard, which is where a curious
 *  visitor can see the shell and an onboarded one belongs. Named once so the
 *  swap is a one-line edit in a single place. */
const CTA_HREF = "/home";

/** One section, rendered by id. */
function Section({ id, dict }: { id: LandingSectionId; dict: LandingDictionary }) {
  switch (id) {
    case "hero":
      // Inline: this is the page's only <h1>, and shell.test.ts reads this file
      // for it. A <header>, not a <SectionShell> — the page's banner carries the
      // top-level heading rather than an h2-labelled region.
      return (
        <header className="landing-hero" id="hero">
          <h1 className="landing-h1">{dict.hero.headline}</h1>
          <p className="voice">{dict.hero.subhead}</p>
          <Button href={CTA_HREF} variant="primary" data-cta="primary">
            {dict.hero.cta}
          </Button>
          <p className="caption">{dict.hero.ctaNote}</p>
        </header>
      );

    case "demo":
      // SECOND on the page, deliberately. §18: the demo is the conversion
      // engine and the mechanic sells itself.
      //
      // Inline: <InlineDemo/> is imported here from the NEUTRAL components/demo/
      // directory, which is the same artifact §17's onboarding screen 2 mounts.
      // landing-page.test.tsx reads THIS file to prove the two surfaces have not
      // forked into two copies of the drill.
      return (
        <SectionShell id="demo">
          <SectionHeading id="demo">{dict.demo.heading}</SectionHeading>
          <p className="landing-lead">{dict.demo.intro}</p>
          <InlineDemo
            label="Al-Ikhlas, verse 1"
            onDone={
              <>
                <p className="caption">{dict.demo.afterNote}</p>
                <Button href={CTA_HREF} variant="primary" data-cta="primary">
                  {dict.hero.cta}
                </Button>
              </>
            }
          />
        </SectionShell>
      );

    case "mechanism":
      return <Mechanism dict={dict} />;

    case "plan":
      return <Plan dict={dict} />;

    case "objections":
      return <Objections dict={dict} />;

    case "proof":
      return <Proof dict={dict} />;

    case "pricing":
      return <Pricing dict={dict} ctaHref={CTA_HREF} />;

    case "footer":
      // Inline: attribution.test.tsx reads this file for the /attribution link,
      // because an attribution page linked from nowhere discharges no
      // obligation (v3-D24). A short LABEL, not prose — boundaries clause 12
      // forbids sentences in this markup, and the attribution page's own copy
      // lives in lib/legal/attribution.ts.
      return (
        <footer className="landing-footer" id="footer">
          <p className="landing-ethics">{dict.footer.ethics}</p>
          <p className="caption">{dict.footer.customer}</p>
          {/* v3-D19's positioning, stated plainly in the footer so it reaches a
              visitor who skipped the objections. */}
          <p className="caption">{dict.footer.position}</p>
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
  // Synchronous and parameterless while there is one locale (v3-D15 ships
  // Malay post-launch). Every section reads its words from this object rather
  // than importing the copy module directly, so a second locale is a change to
  // this line and not to eight components.
  const dict = getDictionary();

  return (
    <>
      <OnboardedSteer />
      <main className="screen landing" id="main">
        {SECTION_ORDER.map((id) => (
          <Section id={id} dict={dict} key={id} />
        ))}
      </main>
    </>
  );
}
