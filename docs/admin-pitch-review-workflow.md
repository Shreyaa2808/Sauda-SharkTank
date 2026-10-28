# Sauda Phase 2 — Admin pitch review and moderation workflow

## Scope

This phase adds a protected queue for submitted `PLATFORM` pitches, Admin publish/reject actions, and an append-only review history. Historical `SHOW` pitches are immutable in this workflow. The public homepage, Founder/Investor workspaces, and existing API contracts are otherwise preserved.

## State transitions

- Only `PLATFORM` pitches in `SUBMITTED` status can be reviewed.
- `PUBLISH` transitions `SUBMITTED` to `PUBLISHED`.
- `REJECT` transitions `SUBMITTED` to `REJECTED` and requires a trimmed note of at least 10 characters.
- Existing Founder logic permits editing/resubmitting a `REJECTED` pitch. Each later decision creates another review event instead of overwriting earlier history.
- A decision holds a `SELECT ... FOR UPDATE` lock and performs the status update plus history insert in one transaction. A second concurrent decision should observe the changed status and receive `409`.

## New API routes

- `GET /api/admin/reviews` — Admin-only; returns submitted platform pitches only.
- `GET /api/admin/reviews/:pitchId` — Admin-only; returns platform pitch details and review history.
- `POST /api/admin/reviews/:pitchId/decision` — Admin-only; body: `{ "decision": "PUBLISH" | "REJECT", "note": "..." }`.
- `GET /api/founder/pitches/:pitchId/reviews` — Founder-only; returns history only when the pitch is a platform pitch owned by the authenticated founder. Non-owned, nonexistent, and `SHOW` pitches return the same `404` response to avoid disclosure.
- `PUT /api/admin/platform-pitches/:pitchId` — Admin-only correction of a PLATFORM listing while preserving status; status changes are rejected and handled through separate review/archive operations.
- `POST /api/admin/platform-pitches/:pitchId/archive` — Admin-only soft archive; existing connection requests are withdrawn/ended consistently and conversation history is retained read-only.
- `POST /api/admin/users/:userId/roles` — Admin-only grant/revoke, audit logged; prevents revoking the last active Admin and provisions role-specific profile rows when granting Founder/Investor.

Every Admin route uses the server-side session and database-derived `ADMIN` role. Frontend role visibility is only a convenience and is not authorization.

## Review-history migration

`database/migrations/004_admin_pitch_review_DRAFT.sql` is intentionally a draft. It adds `pitch_review_event`, with foreign keys to `pitch` and `app_user`, decision, note, reviewer, and timestamp. It does not modify `pitch` or alter any existing migration. Migration 002 (`pitch.updated_at` / `pitch.review_note`) has no runtime consumer and is superseded in `database/migrations/superseded.json`; the original 002 draft file remains unchanged for reference. Migration 003 is also superseded.

Expected clean-test sequence: load the 41-table baseline into an empty guarded disposable database; record 001 as `BASELINED`; skip 002 and 003; then use 004 as the only pending migration for isolated integration testing. Keep 004 marked DRAFT while testing. The migration runner permits explicit application to the guarded test target, but refuses draft migrations on the main target.

Do not apply it automatically or mark it as applied without comparing the target database to the migration. The available physical schema export came from `sharktank_db_test_full_20261023`; it is not proof that `sharktank_db` has identical schema or trigger state. Before applying:

1. Back up the intended target database.
2. Run the read-only schema preflight against that target.
3. Confirm `pitch_review_event` does not already exist and confirm the `pitch` and `app_user` key types.
4. Apply only in a disposable isolated test database first.
5. Verify publish/reject, rollback on failure, history, and concurrent decisions.
6. Obtain explicit approval before applying to a shared/main database.

## Granting the first ADMIN role safely

There is no self-service ADMIN activation, default account, or hardcoded credential in this phase. Grant the role manually to an existing, authorized, active user only after an operator verifies the account identity through an independent channel.

First inspect the exact target account and role:

```sql
SET @admin_email = 'REPLACE_WITH_EXISTING_AUTHORIZED_ACCOUNT_EMAIL';

SELECT user_id, full_name, email, account_status
FROM app_user
WHERE email = @admin_email;

SELECT role_id, role_name
FROM app_role
WHERE role_name = 'ADMIN';
```

Stop if the first query does not return exactly one active account or the second query does not return exactly one `ADMIN` role. Confirm that the selected account belongs to the intended administrator before granting anything.

Only after that independent confirmation, execute this separate transaction, replacing the same placeholder with the already-verified account email:

```sql
START TRANSACTION;

INSERT IGNORE INTO user_role (user_id, role_id)
SELECT u.user_id, r.role_id
FROM app_user u
JOIN app_role r ON r.role_name = 'ADMIN'
WHERE u.email = 'REPLACE_WITH_VERIFIED_ACCOUNT_EMAIL'
  AND u.account_status = 'ACTIVE';

SELECT ROW_COUNT() AS new_admin_role_assignments;

COMMIT;
```

A result of `0` may mean the role was already assigned or that the account/role did not match; verify the mapping with a fresh `SELECT` before concluding. This process creates neither an account nor an ADMIN role and should be run only by a database operator with appropriate privilege. Never commit credentials or local `.env` values.

## Founder feedback

Founders can read review history for their own `PLATFORM` pitches only. The UI exposes feedback on rejected pitch cards. Existing Founder update logic controls whether a rejected pitch can be edited and resubmitted; Admin review code does not open other state transitions.

## Verification status

Unit tests cover pure input validation, role authorization decisions, state-transition rules, and rejection-note requirements. A guarded MySQL integration suite now exists at `server/src/adminReview.integration.test.ts`; it verifies queue/detail/history, publish decision persistence, rollback when the reviewer foreign key fails, and concurrent publish/reject decisions. It requires migration 004 to be recorded `APPLIED` on a local disposable `sauda_test_*` database and must be run using the command in `docs/phase2-admin-review-and-moderation.md`. That DB-backed suite was not run in the packaging environment. No migration is applied automatically, and migration 004 remains a draft pending schema preflight and explicit approval.
