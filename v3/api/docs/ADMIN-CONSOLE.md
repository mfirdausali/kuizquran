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

## 2 · Required environment

| Variable | Purpose | Failure mode if unset |
|---|---|---|
| `ADMIN_EMAILS` | The admin allowlist, comma-separated | **Fails closed** — nobody is admin. Never throws, never opens up. |
| `ADMIN_PSEUDONYM_PEPPER` | HMAC pepper for learner pseudonyms | **Throws.** Deliberately: an unset pepper would silently degrade to a digest that is brute-forceable over small integer user ids — a privacy failure that looks like it works. |
| `ADMIN_REVEAL_TTL_SECONDS` | Server-side reveal TTL (default 900) | Defaults; the server always enforces its own copy, never the client's. |

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
