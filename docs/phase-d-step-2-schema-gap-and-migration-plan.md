# Phase D — Step 2: Schema Gap Analysis and Migration Plan

**Project:** Sauda — Shark Tank India DBMS project
**Status:** Draft for review; no migration has been executed
**Target database:** `sharktank_db` on the existing MySQL Server 8.0.46 / port 3306 connection
**Companion draft:** `database/migrations/001_platform_auth_connections_messaging.sql`

> **Safety rule:** This document and SQL file are review artifacts only. Do not execute the SQL until the preflight checks are reviewed, the assumptions below are approved, and a fresh backup is confirmed. This plan does not connect to or modify the live database.

## 1. Objective

Prepare the smallest non-destructive schema change needed for the next product slice:

1. Support Google sign-in without storing Google credentials or silently linking accounts by email.
2. Represent investor-to-founder connection requests for a specific published platform startup listing.
3. Create a conversation only after a request is accepted, store text messages, and retain read-only history after a connection ends.
4. Preserve the existing historical Shark Tank schema, demo data, routines, triggers, and pitch-interest feature.

This is a college prototype, not an official Shark Tank India service.

## 2. Existing baseline recorded during the database audit

- MySQL Server version reported by Workbench: **8.0.46**, port **3306**.
- Target schema: `sharktank_db`.
- Workbench export was reported successful for all 38 tables to `/Users/shreyaa/dumps/Dump20261021.sql`. Before any future execution, confirm that this exact file exists, is readable, and was created from the intended server. Create a new dated export immediately before migration as well.
- The existing schema contains separate `SHOW` and `PLATFORM` pitches. Its check constraint requires a `SHOW` pitch to have an episode and no submitter, and a `PLATFORM` pitch to have no episode and a non-null `submitted_by_user_id`.
- `pitch.pitch_status` already supports `ARCHIVED`; use it for platform-listing removal rather than physically deleting pitch/company rows.
- `pitch_interest` is an existing show/investor interest feature with its own status vocabulary and unique `(pitch_id, investor_id)` pair. It is **not** the new founder connection-request system and must remain unchanged.
- Existing foreign keys were observed with `NO ACTION` delete/update rules. The new foreign keys likewise do not cascade deletes.
- Six triggers were present. In particular, `before_offer_insert`, `before_offer_update_office_hours`, and `before_offer_delete_office_hours` restrict Offer changes to Monday 14:00–16:00. This appears unusual for the product, but this migration deliberately leaves all existing triggers unchanged. Review them separately; do not drop them as part of this step.
- Existing tables include `app_user`, `app_role`, `user_role`, `founder`, `investor`, `pitch`, and `pitch_interest`. No connection-request/conversation/message tables were observed in the inventory.
- The audit found existing users with normal roles and one active user (`user_id = 5`) with no role row. Do not assign that account a role automatically. Review it manually. New registrations should receive the existing `VIEWER` role by looking up the role name, not by assuming a numeric role ID.
- Demo companies include `Demo Millet Foods`, `GreenWrap Demo`, and `TEST BRAND`. Do not delete demo rows as part of this migration.

The inventory and data observations above are the audit snapshot reported during the prior review; run the preflight queries in Section 8 against the intended connection before applying any changes.

## 3. Gap analysis and decisions

| Area | Existing capability / gap | Draft decision |
|---|---|---|
| Google identity | `app_user` has unique email and required `password_hash`, but no Google subject identifier. | Add nullable `google_subject` with a unique key; permit `password_hash` to be `NULL` for Google-only accounts. Add a check that at least one non-null credential identifier exists. Do not store OAuth client secrets or access tokens in this table. |
| Account linking | Email uniqueness alone cannot prove that an existing account should be linked to a Google identity. | Never auto-link solely because emails match. Require an explicit secure linking flow (reauthentication or equivalent verified proof) in the application. The migration does not implement OAuth. |
| Listing ownership | `pitch.submitted_by_user_id` is required for `PLATFORM` pitch rows. | **Confirmed for this project:** for a `PLATFORM` pitch, `submitted_by_user_id` is the authoritative owner. The owner is the only ordinary founder/editor; preserve the previously specified Administrator moderation/correction and listing-removal permissions. Do not add a duplicate owner column. |
| Startup listing | `pitch_status` already includes `ARCHIVED`. | Archive platform listings using `pitch_status = 'ARCHIVED'`; hide archived rows from public discovery. Do not physically delete companies, pitches, requests, conversations, or messages. |
| Connection request | `pitch_interest` tracks investor interest in the current schema but uses a different lifecycle and investor entity. | Add a dedicated `connection_request` table keyed to the investor's platform user, founder's platform user, and specific pitch. Preserve `pitch_interest` unchanged. |
| Active-pair uniqueness | MySQL does not provide partial unique indexes in the same way as some other engines. | Use nullable stored generated columns and a unique index so a pair can have at most one `PENDING` or `ACCEPTED` request at a time. Inactive historical requests can remain. |
| Conversation | No dedicated connection conversation table was observed. | Add one conversation per accepted request. Unique `request_id` prevents duplicate conversation rows for the same request. Create it in the same application transaction that accepts the request. |
| Messages | No private text-message table was observed. | Add plain-text message records with sender, conversation, body, and timestamp. Validate the sender is one of the two participants in the application. No attachment, video-call, or advanced realtime tables in this phase. |
| Connection end / listing removal | Physical deletion would threaten message history. | When a connection ends, switch its conversation to `READ_ONLY`. The listing owner may archive their listing, and an Administrator may remove/archive it for moderation, consistent with the requirements. Archive by setting `pitch_status = 'ARCHIVED'`; withdraw pending requests, end accepted requests, record the reason/timestamps, and make their conversations read-only in one application transaction. Preserve messages. No new trigger is introduced. |
| Default role | Existing `app_role` / `user_role` already model roles. | On sign-up, insert the existing `VIEWER` role assignment by selecting `app_role.role_id` for `role_name = 'VIEWER'`. Do not hard-code an ID and do not change existing role assignments automatically. |
| Admin privacy | Admin role exists. | Application authorization must prevent admins from reading private message bodies. Being an admin does not grant conversation-participant access. |
| Existing routines / triggers | Stored procedures, functions, and six triggers exist, including coursework-specific Offer office-hours triggers. | Preserve all of them unchanged in this migration. Review the Offer office-hours triggers in a separate, explicitly approved change. |

## 4. Draft relational model

### `app_user` addition

- `google_subject`: nullable, unique Google OpenID Connect subject value. It is an identifier, not a client secret.
- `password_hash`: becomes nullable so a Google-only account can exist.
- Check constraint: a user must have either a non-null password hash or a non-null Google subject.

The application must still validate non-empty password hashes on password-account creation and verify Google ID tokens server-side (signature, issuer, audience/client ID, expiry, and subject). A Google profile/email alone is not proof of ownership of an existing Sauda account. The currently installed `insert_app_user` procedure was audited as requiring a non-empty password hash, so a Google-only signup cannot use that procedure unchanged; use a separate parameterized application insert path or separately review a procedure change.

### `connection_request`

- `pitch_id`: the specific startup listing (`pitch.pitch_type` must be `PLATFORM`, and `pitch.pitch_status` must be `PUBLISHED` at request creation).
- `investor_user_id`: a user with a registered investor profile.
- `founder_user_id`: a user with a registered founder profile and, critically, the same identity as the target pitch's `submitted_by_user_id` under the ownership assumption above.
- Lifecycle: `PENDING`, `ACCEPTED`, `DECLINED`, `WITHDRAWN`, `ENDED`.
- `status_reason` records reasons such as `listing deleted` (the user-facing operation removes the listing from discovery by archiving it, not by physically deleting it).
- `responded_at` is set when the founder accepts or declines; it remains populated when an accepted connection later ends. `withdrawn_at` is set when a pending request is withdrawn by the investor or system. `ended_at` is set only when an accepted connection becomes `ENDED`. A check constraint enforces these status/timestamp combinations.
- Generated pair keys + unique index enforce at most one pending/accepted request for the same investor/founder pair, even if they target different listings. Once a request is declined, withdrawn, or ended, a new request may be made.

The database foreign keys ensure referenced profiles and pitch rows exist. The database cannot express every cross-table business rule here: the application must validate that the pitch is `PLATFORM` and `PUBLISHED`, its submitter equals the named founder, the investor is not the founder, both accounts are active, the investor is authorized, and the requested state transition is legal. Only the recipient founder may accept/decline and only the requester investor may withdraw; a narrowly scoped Administrator may moderate/archive a listing, but may not read private message bodies.

### `conversation`

- Exactly one conversation row per accepted request.
- `OPEN` while the connection is active; `READ_ONLY` once ended or invalidated by listing archive.
- Do not cascade-delete conversations when requests or users change. Account deletion is outside this phase.

### `message`

- Stores text only, with a non-empty body, sender user ID, conversation ID, and server-created timestamp.
- Application routes must authorize only the two participants to read and send messages while the conversation is `OPEN`.
- After it becomes `READ_ONLY`, both participants can read old messages, but neither can send new messages.
- Admin routes must not expose message bodies. Use a separate, explicitly authorized participant query instead of a broad admin “view all” endpoint.

## 5. Required application transaction rules (not implemented by DDL alone)

1. **Create request:** verify active investor user/profile; verify active founder user/profile; verify target is a published `PLATFORM` pitch; verify `pitch.submitted_by_user_id = founder_user_id`; reject self-request; insert `PENDING`.
2. **Accept:** lock/check the pending request; change it to `ACCEPTED`; create exactly one `OPEN` conversation for that request; commit both operations together. Do not create conversations on send or on decline.
3. **Decline / withdraw:** only the receiving founder can decline a pending request; only the requesting investor can withdraw its own pending request.
4. **End:** either participant may end an accepted connection. Change request to `ENDED`, set reason/timestamp, and change its conversation to `READ_ONLY` in one transaction.
5. **Archive listing:** the listing owner or an authorized Administrator initiates removal; set the platform pitch status to `ARCHIVED`. In the same transaction, change pending requests for that pitch to `WITHDRAWN` with a reason such as `listing deleted` and set `withdrawn_at`; change accepted requests to `ENDED` with the same reason and set `ended_at`; set any linked conversations to `READ_ONLY`. Preserve the request, conversation, and messages. The Administrator's archive/removal permission comes from the existing project requirements; it does not grant permission to read private message contents.
6. **Re-request:** after `DECLINED`, `WITHDRAWN`, or `ENDED`, a new request is allowed. The generated-column unique key blocks concurrent `PENDING`/`ACCEPTED` duplicates at the database layer as well.
7. **Viewer default:** after creating a user, insert the `VIEWER` role assignment by role name, unless the registration flow is already doing so. Additional Founder/Investor roles can be assigned through validated onboarding. Admin is granted only by an existing admin.
8. **OAuth account linking:** do not match and link solely by email. If a Google subject is already bound to a different account, reject the linking attempt and require manual/account-recovery handling.

## 6. What this migration deliberately does not do

- It does not create, update, or delete any users or role assignments.
- It does not revise the existing `insert_app_user` procedure, which was audited as requiring a non-empty password hash. Google-only registration must therefore use a separate parameterized application insert path (or a separately reviewed procedure change); do not pass a blank hash to that procedure.
- It does not assign a role to the existing role-less user.
- It does not add ownership by inference to company rows or treat `is_primary_presenter` as listing ownership.
- It does not repurpose `pitch_interest` or change its statuses.
- It does not alter `pitch`, `company`, `founder`, `investor`, `offer`, existing routines, triggers, or current demo data (except the `app_user` auth columns/constraint described above).
- It does not configure Google OAuth credentials or implement login/session logic.
- It does not add message attachments, realtime transport, read receipts, delivery receipts, or search over private message text.
- It does not create foreign-key `CASCADE` paths.
- It does not execute itself or claim transactional rollback. MySQL DDL statements cause implicit commits in relevant contexts and cannot be relied on as a single rollbackable transaction.

## 7. Migration file overview

The companion SQL draft is a one-time migration for MySQL 8.0.46. It:

1. Changes `app_user.password_hash` to nullable, adds `google_subject`, a unique key, and an authentication-credential check constraint.
2. Creates `connection_request`, `conversation`, and `message` with foreign keys and indexes.
3. Uses `NO ACTION` behavior (the MySQL default) and explicitly avoids cascade deletion.

The script is intentionally not idempotent. Do not run it twice. If any statement fails part-way, stop and inspect the exact resulting schema before deciding how to continue. Do not blindly rerun the entire file.

## 8. Preflight checks — inspect results before approval

Run these read-only statements on the existing Workbench connection, before any migration. They are included for review only and have not been executed here.

```sql
SELECT VERSION() AS mysql_version, @@port AS port, DATABASE() AS current_database;
SHOW TABLES FROM sharktank_db;

-- Pre-migration check: google_subject does not exist yet, so do NOT
-- reference it in a query against app_user before the ALTER TABLE.
-- Expected result is 0 for this audited baseline.
SELECT COUNT(*) AS users_without_usable_password_hash
FROM sharktank_db.app_user
WHERE password_hash IS NULL
   OR REGEXP_LIKE(password_hash, '^[[:space:]]*$');

-- Expected result is 0 before the migration adds google_subject.
SELECT COUNT(*) AS existing_google_subject_columns
FROM information_schema.columns
WHERE table_schema = 'sharktank_db'
  AND table_name = 'app_user'
  AND column_name = 'google_subject';

-- Verify that profile users are not duplicated (the schema currently declares these user_id columns UNIQUE).
SELECT user_id, COUNT(*) AS rows_per_user
FROM sharktank_db.founder
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1;

SELECT user_id, COUNT(*) AS rows_per_user
FROM sharktank_db.investor
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Confirm that the expected role exists; do not assume a numeric role_id.
SELECT role_id, role_name
FROM sharktank_db.app_role
WHERE role_name IN ('VIEWER', 'FOUNDER', 'INVESTOR', 'ADMIN')
ORDER BY role_name;

-- Confirm platform pitch data and ownership assumption before implementing services.
SELECT p.pitch_id, p.pitch_type, p.pitch_status,
       p.submitted_by_user_id, c.brand_name
FROM sharktank_db.pitch AS p
JOIN sharktank_db.company AS c ON c.company_id = p.company_id
WHERE p.pitch_type = 'PLATFORM'
ORDER BY p.pitch_id;

-- Make sure a table name is not already occupied by an earlier experimental implementation.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'sharktank_db'
  AND table_name IN ('connection_request', 'conversation', 'message');
```

**Stop conditions:** do not proceed if the current database/version is unexpected, the backup cannot be confirmed, `users_without_usable_password_hash` is non-zero, `existing_google_subject_columns` is non-zero, an expected role is absent, the platform-listing owner check is inconsistent with the confirmed rule, or any of the three new table names already exists. Reconcile those findings first.

## 9. Post-migration verification checklist

After the migration has been explicitly approved and executed once, verify:

- `app_user.google_subject` exists and is unique; `password_hash` is nullable; the auth-identifier checks exist.
- The three new tables exist with all named foreign keys and indexes.
- All original table counts and existing sample rows are unchanged.
- `pitch_interest`, its unique key and statuses are unchanged.
- Existing procedures, functions, and six triggers remain present and unchanged.
- No rows were automatically added to `user_role`; no existing user roles were changed.
- No user, pitch, company, offer, conversation, or message row was deleted by the migration.
- The new tables are empty immediately after migration.
- A controlled test in a **disposable test database** covers pending request, accept/conversation creation, decline/withdraw, re-request, end/read-only history, listing archive, duplicate active-pair rejection, self-request rejection, non-platform pitch rejection, and participant-only message access. Do not use live demo data as the first destructive/behavioral test.

Example read-only structural checks:

```sql
SHOW CREATE TABLE sharktank_db.app_user;
SHOW CREATE TABLE sharktank_db.connection_request;
SHOW CREATE TABLE sharktank_db.conversation;
SHOW CREATE TABLE sharktank_db.message;

SELECT COUNT(*) AS connection_request_rows FROM sharktank_db.connection_request;
SELECT COUNT(*) AS conversation_rows FROM sharktank_db.conversation;
SELECT COUNT(*) AS message_rows FROM sharktank_db.message;
```

## 10. Rollback / recovery posture

There is no safe promise of a single `ROLLBACK` for this migration: MySQL DDL can implicitly commit. The recovery baseline is a verified pre-migration logical export and a record of each statement that succeeded. If an error occurs, stop; do not re-run the complete script and do not issue guessed `DROP` or reverse `ALTER` statements. Inspect the actual schema and decide a statement-by-statement recovery plan. Restoring a dump overwrites state and must only be considered with explicit approval and a verified restore target.

## 11. Remaining design decision before implementation

1. **Google-only registration:** this draft provisionally permits users to register with a verified Google identity and a `NULL` password hash. Confirm this feature is in scope before applying the migration. Existing accounts and password hashes are preserved, accounts are never linked automatically solely by matching email, and the backend must validate Google ID tokens server-side.

Confirmed/settled in the project requirements: `pitch.submitted_by_user_id` is the authoritative owner for a `PLATFORM` listing; only that owner has ordinary founder editing rights, with the previously specified Administrator moderation/correction permissions retained. At most one `PENDING`/`ACCEPTED` request is allowed per investor/founder pair across all listings. Listing removal archives the pitch, withdraws pending requests, ends accepted connections, and preserves existing messages in read-only mode. Administrators do not gain access to private message bodies.

**Recommended next step:** review this plan and the SQL together. Only after the remaining Google-only registration decision and preflight results are agreed should a reviewed migration be applied to a disposable clone first, then considered for the backed-up target database.
