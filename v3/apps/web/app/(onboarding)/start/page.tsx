// "/start" — THE SEVEN-SCREEN ONBOARDING (WIREFRAME §17).
//
// A SERVER COMPONENT that renders one client island. The flow is inherently
// stateful (seven steps, four answers held until a single commit) and screen 2
// runs the reconstruct state machine per tap, so the flow itself is a client
// island — but the ROUTE stays a server component so nothing here is tempted to
// read the log at the top level (edge case #72).
//
// WHY ONE ROUTE AND NOT SEVEN. The four answers are held in React state and
// committed exactly once, at screen 7 (see lib/onboarding/choices.ts for why a
// partial write is the failure mode that matters). Seven routes would mean
// either seven partial writes or a state blob smuggled through the URL, and the
// first of those is precisely what strands a learner half-onboarded. The step
// is still visible in the UI and still backable, one screen at a time.
//
// THE GOVERNING RULE. This route is a PRE-RECALL surface and is listed as one
// in `check-boundaries.mjs` clause 8 (`^app/\(onboarding\)/`). Screens 1 and 2
// capture nothing at all — not a field, not an event, not a meta key.

import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const metadata = {
  title: "Start — Iman Quiz",
};

export default function StartPage() {
  return (
    <div className="screen">
      <OnboardingFlow />
    </div>
  );
}
