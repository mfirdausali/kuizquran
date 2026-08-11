# Stripe replay fixtures — EMPTY, and the gate is RED

Build-plan step 23 (M7). **Exit criterion: "replay suite green".**

## Status: BLOCKED — the fixture set is empty

There is **no test-mode Stripe account** for this project yet, so no real event
JSON has been recorded. `tests/Feature/Billing/ReplaySuiteTest.php` therefore
asserts a **minimum fixture count before it asserts any behaviour**, and reports
the suite as incomplete rather than passing over zero cases.

This is deliberate. A suite that passes vacuously on an empty fixture set is
exactly the failure this build has already shipped five times — most precisely
**v3-D50**, where `phpunit.xml` named a testsuite directory that existed on one
machine, so 71 tests silently never ran while every report said green. An empty
green replay suite would be that again, on the revenue path.

**Do not "fix" this by inventing JSON.** Hand-written payloads prove the handlers
parse hand-written payloads. The entire value of the replay suite is proving they
parse what Stripe *actually sends* — field names, nesting, types, and the ordering
of real deliveries.

## What must happen (human-gated, calendar lead time — start now)

1. **Stripe business verification, Malaysian entity.** KYC, bank account, tax
   details. Days to weeks. `docs/BUILD-PLAN.md` M7 says "Stripe account from M0",
   so if this has not started it is already **late**, and it gates everything
   below.
2. **FPX + GrabPay activation** — per-method Stripe approval, needed for the
   lifetime rail in MY (edge case #120; monthly stays card-only regardless).
3. **Record the fixtures**, once test-mode keys exist:

   ```bash
   stripe listen --forward-to localhost:8001/api/billing/stripe/webhook
   # in another shell, one per event, saving each response body:
   stripe trigger checkout.session.completed
   stripe trigger invoice.paid
   stripe trigger invoice.payment_failed
   stripe trigger customer.subscription.updated
   stripe trigger customer.subscription.deleted
   stripe trigger charge.refunded
   stripe trigger charge.dispute.created
   stripe trigger charge.dispute.closed
   ```

   Save each event's raw JSON here as `<event.type>.<n>.json`, **vendored on the
   day of fetch** — the same discipline the corpus pipeline uses for Quran.com
   responses (edge case #24). Record the fetch date in `PROVENANCE.md`.

4. A **partial refund** and a **dispute-won** case must be recorded explicitly.
   `stripe trigger` produces the full-refund and dispute-lost shapes by default,
   and those two are precisely the transitions edge cases #115 and #116 exist for.

## What is NOT blocked

The state machine, the guarded transitions, the idempotency index, the ordering
precedence, the merge rule and the signature verification are **fully built and
fully tested** — see `EntitlementStateMachineTest` (16 tests, every one
mutation-verified) and `StripeSignatureTest`. Those tests drive the handlers with
event arrays in the recorded shape, which is legitimate: they exercise **domain
logic**, and domain logic is not Stripe's wire format.

The single thing that remains unproven until fixtures land: **that Stripe's real
payloads carry the field names these handlers read.** That gap is tracked as
`DEFECTS.md#PAY-1` and is the only reason this directory is not already full.
