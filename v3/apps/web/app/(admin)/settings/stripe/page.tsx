// "/settings/stripe" — THE STRIPE CREDENTIAL SCREEN (admin console).
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT IN THE (app) ROUTE GROUP
// ---------------------------------------------------------------------------
// `(app)` is the LEARNER shell. This is staff tooling: it inherits no learner
// chrome, appears in no tab bar, and cannot be reached by tapping around the
// product. Same reasoning as `/workbench`, which sits in the same group.
//
// ---------------------------------------------------------------------------
// WHY THE FIELDS ARE READ-ONLY
// ---------------------------------------------------------------------------
// Firdaus asked for admin fields to enter Stripe info. This screen shows every
// one of those fields, what each is for, whether it is installed, which mode it
// is in, and whether it actually authenticates against Stripe — and it points
// at the environment for the values themselves.
//
// The reason is in `StripeSettingsController`'s header, and it is one-way: a
// live `sk_live_…` key written into the database is readable from every backup
// and every replica, and no amount of later care un-leaks it. The server refuses
// the write (501, with the reason), so a form here that pretended otherwise
// would just be a form that always fails. If you want the DB-backed editable
// version, that is a decision you can make — the refusal is deliberate, not a
// missing feature, and the controller says what it would take to do it safely.
//
// This screen never receives a secret. The API returns presence, mode and a
// last-four fingerprint; a test asserts the raw response body contains no
// secret value at all.

import { StripeSettingsPanel } from "@/components/admin/StripeSettingsPanel";

export default function StripeSettingsPage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Stripe</h1>
          <p className="caption">
            Payment credentials — what is installed, and whether it works.
          </p>
        </header>
        <StripeSettingsPanel />
      </div>
    </div>
  );
}
