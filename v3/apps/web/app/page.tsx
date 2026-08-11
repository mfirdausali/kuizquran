// "/" — THE LANDING PAGE (v3-D14, edge case #71).
//
//   "/" = landing, stateless. "/home" = dashboard. They are different pages
//   with different audiences and they never collide.
//
// This is a SERVER COMPONENT and it stays one. It reads no IndexedDB (a
// landing page has no learner), imports no engine, and holds no state — which
// is what lets it be cached and served instantly, including by the service
// worker while offline.
//
// It has no tab bar, because it is outside the (app) route group. Showing
// learner navigation to a visitor who has not started would be a lie about
// what they have.
//
// The only client JS on this page is <OnboardedSteer/>, which renders nothing
// and exists solely to redirect an already-onboarded learner to /home — see
// that file for why middleware cannot do this job alone (a service worker
// bypasses it entirely).
//
// TODO(build-plan step 29 / M10, WIREFRAME §18 + §25): the real landing page.
// Eight sections, and the INTERACTIVE DEMO (§2 of that table) is the
// conversion engine — a working tap-to-reconstruct of Al-Ikhlas 112:1, inline,
// no install. It ships AFTER the drill works, never before. Its Arabic, like
// all Arabic in this app, arrives at runtime from the compiled corpus.

import Link from "next/link";
import { OnboardedSteer } from "@/components/shell/OnboardedSteer";
import { StubNote } from "@/components/shell/StubNote";

export default function LandingPage() {
  return (
    <>
      <OnboardedSteer />
      <main className="screen">
        <div className="stack">
          <header className="page-head">
            <h1>You memorized it. Do you still have it?</h1>
            <p className="voice">Memorise, and keep what you memorise.</p>
          </header>

          <div className="card">
            {/* The real CTA is "Start with one ayah — free, no account"
                (§18). Until onboarding exists (step 20 / M6) it points at the
                dashboard, which is where an onboarded learner belongs and
                where a curious one can see the shell. */}
            <Link href="/home" className="btn btn--primary hit" role="button">
              Open the app
            </Link>
            <p className="caption">
              No ads. No selling data. No dark patterns. No guilt notifications.
            </p>
          </div>

          <StubNote step="step 29 (M10), WIREFRAME §18 + §25">
            The full landing page: hero, the inline tap-to-reconstruct demo
            (the conversion engine), the mechanism, the plan calendar, the
            objections, the proof, pricing (v3-D07), and the footer. It ships
            after the drill works — describing the mechanic does not sell it.
          </StubNote>
        </div>
      </main>
    </>
  );
}
