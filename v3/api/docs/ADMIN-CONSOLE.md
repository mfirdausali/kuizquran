# Admin console — operations, and the grant that makes the audit log real

Build-plan steps 24 & 26 (M8). This file is referenced by
`app/Models/AdminAudit.php` and by
`database/migrations/2026_08_11_110000_create_admin_roles_and_audit_tables.php`,
both of which promise a database-level append-only guarantee **and name this
document as where the grant lives.**

It was missing until the M10 launch audit. That mattered: the ORM guard alone is
application discipline, and this build has watched conventions fail repeatedly.

---

## 1 · The append-only grant (PRODUCTION — REQUIRED BEFORE LAUNCH)

`admin_audit` is append-only in **two layers**, because either alone is
insufficient:

| Layer | What it stops | Where it holds |
|---|---|---|
| **DB permission** (this section) | Any UPDATE or DELETE, including from a raw query, a psql session, a future developer, or code that bypasses the model entirely | Production Postgres |
| **ORM guard** (`AdminAudit::booted`) | The same, with a clear error, in development and in SQLite tests where per-table grants do not exist | Everywhere |

The ORM guard is tested (`AdminPrivacyTest::test_an_audit_row_can_never_be_updated_or_deleted`).
**The grant cannot be tested from inside the application that lacks it** — an app
holding UPDATE rights cannot prove it does not hold them. So it is verified by
running the check below against production, by a human, and recording the date.

### Apply the grant

Run as the database **owner** (not as the application role):

```sql
-- The application connects as this role. Adjust the name to match your
-- DB_USERNAME. It must NOT be the table owner, or grants are moot.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE admin_audit FROM app_role;
GRANT  INSERT, SELECT                ON TABLE admin_audit TO   app_role;

-- The sequence still needs to advance for INSERT to work.
GRANT USAGE, SELECT ON SEQUENCE admin_audit_id_seq TO app_role;
```

Apply the same treatment to any future append-only table.

> **The app role must not own the table.** In Postgres an owner retains implicit
> rights regardless of `REVOKE`, so a grant applied to an owning role is
> decoration. Create the schema as a migration/owner role and connect the app as
> a separate, lesser role.

### Verify the grant (run this, do not assume)

```sql
SELECT privilege_type
FROM   information_schema.role_table_grants
WHERE  table_name = 'admin_audit'
  AND  grantee    = 'app_role';
--  EXPECT exactly: INSERT, SELECT
--  If UPDATE, DELETE or TRUNCATE appear, the audit log is editable and the
--  guarantee this console is built on does not hold.
```

Destructive proof, on staging only:

```sql
SET ROLE app_role;
UPDATE admin_audit SET reason_text = 'tampered' WHERE id = 1;
--  EXPECT: ERROR: permission denied for table admin_audit
DELETE FROM admin_audit WHERE id = 1;
--  EXPECT: ERROR: permission denied for table admin_audit
RESET ROLE;
```

**Record here when this was last verified against production:**

| Date | Environment | Verified by | Result |
|---|---|---|---|
| _(not yet run — no production or staging environment exists; LAUNCH-CHECKLIST gate 20)_ | | | |

---

## 1b · The same grant for `purge_ledger` (build-plan step 23 / gate 19)

`purge_ledger` is append-only for the identical reason `admin_audit` is: it is
the record `BackupRestoreDrillCommand` reconciles a restore against (§13 of
LAUNCH-CHECKLIST.md — "a PDPA delete must not be undone by a restore"), and an
editable ledger could silently resurrect a learner who was purged. `PurgeLedgerEntry::booted()`
is the ORM layer; this is layer 1, not yet applied anywhere because no
production database exists yet (same gap as §1 above).

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE purge_ledger FROM app_role;
GRANT  INSERT, SELECT                ON TABLE purge_ledger TO   app_role;
GRANT USAGE, SELECT ON SEQUENCE purge_ledger_id_seq TO app_role;
```

Verify the same way as §1's grant, substituting `purge_ledger` for
`admin_audit` in the `information_schema.role_table_grants` query.

---

## 1c · The same grant for `ayah_verifications` (build-plan step 15 / DEFECTS.md#B3)

`ayah_verifications` is append-only for the reason DEFECTS.md#B3 exists at all:
it is the qari's and the admin's signature chain — "verified = ANY row's
content_hash matches the CURRENT corpus hash" is only a meaningful audit trail
if a row, once signed, can never be rewritten or removed. `AyahVerification::booted`
is the ORM layer (layer 2); this is layer 1, not yet applied anywhere because no
production database exists yet (same gap as §1/§1b above).

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE ayah_verifications FROM app_role;
GRANT  INSERT, SELECT                ON TABLE ayah_verifications TO   app_role;
GRANT USAGE, SELECT ON SEQUENCE ayah_verifications_id_seq TO app_role;
```

Verify the same way as §1's grant, substituting `ayah_verifications` for
`admin_audit` in the `information_schema.role_table_grants` query.

---

## 1d · The same grant for `gloss_draft_reviews` (build-plan step 27 / DEFECTS.md#B3)

`gloss_draft_reviews` is append-only for the same B3 reason `ayah_verifications`
is: `text_at_review` snapshots the bytes a reviewer actually approved, and an
editable approval record is not an approval record. `GlossDraftReview::booted`
is the ORM layer (layer 2); this is layer 1, not yet applied anywhere because no
production database exists yet (same gap as §1/§1b/§1c above).

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE gloss_draft_reviews FROM app_role;
GRANT  INSERT, SELECT                ON TABLE gloss_draft_reviews TO   app_role;
GRANT USAGE, SELECT ON SEQUENCE gloss_draft_reviews_id_seq TO app_role;
```

Verify the same way as §1's grant, substituting `gloss_draft_reviews` for
`admin_audit` in the `information_schema.role_table_grants` query.

---

## 1e · The same grant for `overrides` (build-plan step 15 / DEFECTS.md#B1/#B4)

`overrides` is append-only for a slightly different reason than §1–§1d's
sign-off tables, but the same mechanism: a correction is always a NEW row with
a later `created_at` (B4's `(created_at, id)` tie-break resolves latest-wins
across rows, never by editing one), and `App\Support\CorpusHashRecomputer`
(v3-D81, closing B3) only fires from the INSERT path in
`OverridesController::store()`. An in-place UPDATE would silently bypass the
re-hash entirely — the content-after-hash sequencing bomb one layer below the
corpus/spec freeze. `Override::booted` is the ORM layer (layer 2); this is
layer 1, not yet applied anywhere because no production database exists yet
(same gap as §1/§1b/§1c/§1d above). Note `overrides.editor_id` is
`nullOnDelete`, not `cascadeOnDelete` — a PDPA purge nulls the editor
reference on a deleted admin, it never deletes an override row, so this grant
has no purge-cascade interaction to reconcile.

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE overrides FROM app_role;
GRANT  INSERT, SELECT                ON TABLE overrides TO   app_role;
GRANT USAGE, SELECT ON SEQUENCE overrides_id_seq TO app_role;
```

Verify the same way as §1's grant, substituting `overrides` for `admin_audit`
in the `information_schema.role_table_grants` query.

---

## 1f · The same grant for `nightly_check_runs` (build-plan step 30 / edge case #169)

`nightly_check_runs` is append-only because the 7-consecutive-green-nights
launch gate reads it as evidence, not as a trusted counter — edge case #169,
"7-green-nights arithmetic → contested gate." A streak whose underlying runs
can be edited or deleted after the fact is not a streak, it is a claim.
`NightlyCheckRun::booted` is the ORM layer (layer 2); this is layer 1, not yet
applied anywhere because no production database exists yet (same gap as
§1/§1b/§1c/§1d/§1e above). This table carries no foreign key to `users` at
all, so unlike `events`/`entitlement_transitions` there is no PDPA purge
cascade to reconcile this grant against.

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE nightly_check_runs FROM app_role;
GRANT  INSERT, SELECT                ON TABLE nightly_check_runs TO   app_role;
GRANT USAGE, SELECT ON SEQUENCE nightly_check_runs_id_seq TO app_role;
```

Verify the same way as §1's grant, substituting `nightly_check_runs` for
`admin_audit` in the `information_schema.role_table_grants` query.

---

## 1g · The same grant for `events` (build-plan step 14 / invariant #2)

`events` is append-only because the whole app is built on invariant #2: the
event log is truth, `atom_cache` a rebuildable fold of it. `Event::booted`
is the ORM layer (layer 2); this is layer 1, not yet applied anywhere
because no production database exists yet (same gap as §1/§1b–§1f above).

**This grant must NOT block the PDPA purge cascade, and it does not need
to.** `events.user_id` is `ON DELETE CASCADE`; a `REVOKE UPDATE, DELETE`
on the app role stops the app from issuing its OWN `UPDATE`/`DELETE`
against `events`, but a cascade triggered by deleting the PARENT `users`
row is executed by the database engine as part of that single statement,
under the privileges the delete on `users` already required — it is not a
second, separate DML statement against `events` that the revoked grant
would catch. (The ORM-layer proof of the equivalent fact — that Eloquent's
own `deleting` event is never dispatched for a cascaded row either — is in
`Event`'s docblock and DECISIONS.md v3-D374.)

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE events FROM app_role;
GRANT  INSERT, SELECT                ON TABLE events TO   app_role;
GRANT USAGE, SELECT ON SEQUENCE events_id_seq TO app_role;
```

Verify the same way as §1's grant, substituting `events` for `admin_audit`
in the `information_schema.role_table_grants` query. The destructive proof
should ALSO confirm the cascade still works under the revoked grant: as
`app_role`, deleting a `users` row that owns `events` rows must still
remove them (the cascade), while a direct `DELETE FROM events WHERE ...`
must still be refused.

---

## 1h · The same grant for `entitlement_transitions` (build-plan step 23 / edge case #114)

`entitlement_transitions` is append-only for the identical reason `events`
is, and carries the identical `user_id cascadeOnDelete()` shape — see §1g's
note on why a PDPA purge cascade is unaffected by this grant.
`EntitlementTransition::booted` is the ORM layer (layer 2); this is layer
1, not yet applied anywhere because no production database exists yet
(same gap as §1/§1b–§1g above).

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE entitlement_transitions FROM app_role;
GRANT  INSERT, SELECT                ON TABLE entitlement_transitions TO   app_role;
GRANT USAGE, SELECT ON SEQUENCE entitlement_transitions_id_seq TO app_role;
```

Verify the same way as §1g's grant, substituting `entitlement_transitions`
for `events`.

---

## 1i · The same grant for `specs` (build-plan step 15 / v3-D33, v3-D377)

`specs` is append-only for the identical reason `overrides` (§1e) is:
IMMUTABLE/versioned/tombstone-as-flip by design — an edit is always a NEW
row at `spec_id`/`version+1`, and deactivating a spec flips a new row's
`active` to `false`, never deletes one. `SpecsController` only ever calls
`Spec::create()` — never `->update()`/`->delete()` — but that was, until
v3-D377, discipline only: no structural guard enforced it, unlike every
other table making the identical IMMUTABLE/append-only claim.
`Spec::booted` is the ORM layer (layer 2); this is layer 1, not yet applied
anywhere because no production database exists yet (same gap as
§1/§1b–§1h above). `specs.author_id` is `nullOnDelete`, not
`cascadeOnDelete` — a PDPA purge nulls the author reference on a deleted
admin, it never deletes a spec row, so this grant has no purge-cascade
interaction to reconcile (same as §1e's `overrides.editor_id` note).

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE specs FROM app_role;
GRANT  INSERT, SELECT                ON TABLE specs TO   app_role;
GRANT USAGE, SELECT ON SEQUENCE specs_id_seq TO app_role;
```

Verify the same way as §1's grant, substituting `specs` for `admin_audit`
in the `information_schema.role_table_grants` query.

---

## 1j · The same grant for `flag_ramp_audit` (build-plan step 26)

`flag_ramp_audit` is append-only for the identical reason `admin_audit` is:
its own model docblock says its four ceremony inputs are "STORED, not merely
validated — 'we checked at the time' is unverifiable after the fact," and
that is only true if a row, once written, can never be rewritten or removed.
`FlagRampAudit::booted` is the ORM layer (layer 2); this is layer 1, not yet
applied anywhere because no production database exists yet (same gap as
§1/§1b–§1i above). `flag_ramp_audit.actor_admin_id` is `nullOnDelete`, not
`cascadeOnDelete` — a PDPA purge nulls the actor reference on a deleted
admin, it never deletes a ramp-audit row, so this grant has no purge-cascade
interaction to reconcile (same as §1e's `overrides.editor_id` note).

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE flag_ramp_audit FROM app_role;
GRANT  INSERT, SELECT                ON TABLE flag_ramp_audit TO   app_role;
GRANT USAGE, SELECT ON SEQUENCE flag_ramp_audit_id_seq TO app_role;
```

Verify the same way as §1's grant, substituting `flag_ramp_audit` for
`admin_audit` in the `information_schema.role_table_grants` query.

---

## 2 · Required environment

| Variable | Purpose | Failure mode if unset |
|---|---|---|
| `ADMIN_EMAILS` | The admin allowlist, comma-separated | **Fails closed** — nobody is admin. Never throws, never opens up. |
| `ADMIN_PSEUDONYM_PEPPER` | HMAC pepper for learner pseudonyms | **Throws.** Deliberately: an unset pepper would silently degrade to a digest that is brute-forceable over small integer user ids — a privacy failure that looks like it works. |
| `ADMIN_REVEAL_TTL_SECONDS` | Server-side reveal TTL (default 900) | Defaults; the server always enforces its own copy, never the client's. |
| `PDPA_DELETION_GRACE_DAYS` | Days between a learner's delete request and `pdpa:purge-due` actually removing the row (default 14) | Defaults; see `config/pdpa.php`. |

An admin must **also have a verified email** (`EnsureIsAdmin`). This closes
DEFECTS.md#B7: in v2, anyone who knew an allowlisted address could register it
and become admin before the real admin ever signed in.

---

## 3 · Break-glass

The allowlist is environment-driven, so recovery from a lockout is:

1. Edit `ADMIN_EMAILS` in the environment.
2. Restart the application.
3. Sign in. Verify the email if the account is new.

There is deliberately **no in-app escalation path** — a self-service admin
promotion is the same hole B7 was.

> This assumes someone can reach the host. See LAUNCH-CHECKLIST gate 20:
> no host exists yet, and no pager rotation is assigned.

---

## 4 · Identity handling — the one path

Identity leaves this system through exactly one route:

```
POST /api/admin/users/{userId}/reveal
```

with a structured `reason_code` (closed set), a `reason_text` of ≥10 characters
that is **scanned for PII before commit**, and an audit row written *first,
inside the transaction* — including for a missing or anonymous subject, which is
what makes user-id probing visible instead of silent.

Everything else is pseudonymous. The bulk CSV export
(`GET /api/admin/users/export.csv`) has **no parameter, config or branch that
can add identity**, and is itself audited before the stream opens.

A reveal token is bound to the admin who minted it; presenting another
operator's token is refused with the same response as an expired or unknown one.

---

## 5 · The only mutating health action

`POST /api/admin/health/rebuild-atom-cache` **re-derives** the atom cache from
the event log. It never invents state — WIREFRAME §16: staff may never edit
graded state. It runs behind a mutex; a second click queues rather than racing
(edge case #168), because two concurrent folds can interleave into a state
neither would produce and then page as a P1 that never happened.

A failed health probe renders `unknown`, **never `0`** (edge case #167). The
console must be able to distinguish "healthy" from "blind".

---

## 6 · Flag plane

- **Kill** is one click, unconditional, no ceremony, no version — friction on the
  safety path is how a harmful feature stays live an extra ten minutes.
- **Enable** requires the full ceremony, server-enforced: reason ≥20 characters,
  two named ethics acknowledgements, the flag name typed **verbatim**, and the
  **version you read** (omitting it is refused — a default would compare the row
  against itself and let a ramp silently overwrite a concurrent kill).
- An acknowledgement never re-enables anything (#159).
- All flags default **OFF**.
