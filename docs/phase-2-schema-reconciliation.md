# Phase 2 — Schema reconciliation and reproducible setup (second pass, with schema export)

**Status: RECONCILED against the supplied export, with open items.** A baseline and a minimal reference seed
now exist. Nothing was run against any database; all verification is static (file parsing and unit tests).
Remaining open items are listed in section 8.

## 1. Evidence, and its limits
- **Supplied:** `sauda_test_full_schema.sql` — a `mysqldump --no-data` of **`sharktank_db_test_full_20261023`**
  (MySQL 8.0.46, completed 2026-10-27 14:08:52). It is a *test clone*, not proof of what `sharktank_db` contains.
- **Not supplied:** the read-only inspection results (`database/preflight/phase2_readonly_schema_inspection.sql`).
  So nothing below is known about `sharktank_db` itself, and no reference-data values (industry/stage names) were seen.
- The dump has **no triggers and no routines**, and no data.

## 2. Which migrations are represented (determined from the physical schema, not from file names or app code)

| Migration | Represented in export? | Evidence | Status now |
|---|---|---|---|
| **001** auth + connections + messaging | **Yes, fully** | `app_user.google_subject` (utf8mb4_bin) + `uq_app_user_google_subject` + 3 CHECKs; `password_hash` nullable; `connection_request`, `conversation`, `message` with every column, key, FK and CHECK of the draft (including the generated `active_*` columns and `uq_connection_request_active_pair`). Verified object-by-object by `baseline.test.ts`. | File left **unchanged and still marked DRAFT**. It is part of the baseline; never run it on a database that has these objects. |
| **002** pitch `updated_at` / `review_note` | **No** | `pitch` has neither column, and a static scan found no runtime use of `pitch.updated_at` or `pitch.review_note`. | **Superseded** and retained unchanged for historical reference. `updated_at` has no current consumer; review decisions/notes are recorded by 004 in `pitch_review_event`. The runner skips 002. This does not approve 004. |
| **003** `user_saved_pitch` (my first-pass draft) | **Superseded — my earlier claim was wrong** | The table **already exists** in the export from the original schema, with an extra `private_notes text` column and non-cascading FKs. 41 tables = the 38 original + the 3 from 001, so it pre-dates 001. | File replaced by a comment-only tombstone; listed in `database/migrations/superseded.json`; the runner skips it. |

I previously reported `user_saved_pitch` as missing from the database. It was only missing from the repo's migrations
(as `INTEGRATION_NOTES.md` said); the physical table was there all along.

## 3. Backend queries vs the physical schema (static comparison)
Every column the backend reads or writes exists: all `INSERT` column lists are extracted automatically from
`server/src/*.ts` and checked; SELECT/UPDATE columns were checked from a curated list (reviewed by hand). Also confirmed:
- `user_role (user_id, role_id)` is the PK, so `INSERT IGNORE` is genuinely idempotent.
- `founder.user_id` and `investor.user_id` are UNIQUE (nullable), so the `ON DUPLICATE KEY` upserts and 001's FKs work.
- `pitch.pitch_status` enum = `DRAFT, SUBMITTED, PUBLISHED, REJECTED, ARCHIVED`, identical to the backend `PitchStatus` type.
- `pitch` CHECK keeps `SHOW` (episode, no submitter) and `PLATFORM` (no episode, submitter) distinct. The founder
  validation range (equity 0.01–100) matches `pitch_chk_2`.
- The connection status transitions in `workspaces.ts` / `founder.ts` satisfy `chk_connection_request_timestamps`
  and `chk_conversation_closed_timestamp`.
- Schema columns the app ignores: `user_saved_pitch.private_notes`, and most historical/analytics tables
  (offers, closed deals, battles, comments, predictions, ...).

## 4. Deliverables
- `database/baseline/001_baseline_schema.sql` — the 41 `CREATE TABLE`s from the export. Mechanical changes only: removed `DROP TABLE`/session
  settings, removed clone-specific `AUTO_INCREMENT=N`, ordered by foreign-key dependency. No data, no triggers.
- `database/baseline/002_reference_seed.sql` — only the four role names the code looks up by name
  (`VIEWER`, `FOUNDER`, `INVESTOR`, `ADMIN`), via `INSERT IGNORE` on the unique `role_name`; ids not hardcoded; **no users, no admin account**.
- `database/baseline/BASELINE_INFO.json` — declares the baseline contains migration 001 with the evidence statement. Used by `db:test:create`.
- `database/migrations/superseded.json` lists 002 and 003. Migration 002 remains unchanged as a draft for historical reference; migration 003 remains a comment-only tombstone. The runner skips both and refuses to manually mark either as applied. Tests cover this and the clean-baseline plan.

**Not seeded (no evidence of the values):** `industry` (the clone had 4 rows) and `startup_stage` (6 rows). Until supplied, a fresh database has no industry/stage choices for the founder form.

## 5. Test-database workflow (static verification only)
`db:test:create` → guard checks → loads `baseline/*.sql` in order → creates `schema_migrations` → records the migrations listed in
`BASELINE_INFO.json` records 001 as `BASELINED`, and the runner prints the migration it recorded. The clean-test plan then skips
superseded migrations 002 and 003 and leaves **004 as the only pending migration**. Migration 004 remains marked DRAFT;
the runner permits an explicitly opted-in apply only when the target is a guarded disposable `sauda_test_*` database, so
Phase 3 can be integration-tested without approving it for the main database. This sequence is covered by static unit
tests but has **not** been executed against MySQL in this patch.

## 6. Triggers and routines — report only, nothing changed
- The export contains **no `CREATE TRIGGER`/routine definitions**. The Phase D document reported six triggers on `sharktank_db`, including
  Offer insert/update/delete restricted to **Monday 14:00–16:00**. This clone shows none, so either they exist only on `sharktank_db`,
  the dump omitted them, or they were removed from the clone. This evidence cannot tell which.
- `application_audit_log` (JSON old/new data) has one row in the clone (AUTO_INCREMENT=2), so *something* wrote to it once; the writer is unknown.
- **Impact if the Monday restriction is real in the target DB:** any Offer insert/update/delete outside Mon 14:00–16:00 fails, which will block
  historical-data seeding and CSV import (Phases 5 and 8). No trigger was dropped or altered, and none should be without the definitions and your approval.

## 7. Other observations for later phases (no action taken)
- `show_season.country_franchise` is free text (default `'India'`) and money columns carry no currency code → Phase 6 design.
- `offer`, `offer_investor`, `closed_deal`, `deal_status_history`, `show_episode`, `episode_shark_seat`, `shark` already exist → Phase 5 should build on them, not duplicate.
- `pitch` has no `updated_at`/legacy `review_note` column. No current runtime consumer needs them; migration 002 is superseded. Phase 3 review decisions and notes use the separate `pitch_review_event` table introduced by draft migration 004.
- `pitch.company_id` composite unique keys and `company_metric_snapshot` FKs mean seed order matters (company → snapshot → pitch).

## 8. Missing information (exact list) — do not guess
1. **Read-only inspection results for `sharktank_db` (the real application DB)**, at least sections 0, 8 and 9 — to know whether 001 is applied there (if yes: `db:migrate -- --mark-applied 001 --confirm-db <name>`, done by you), whether it has the triggers, and whether the role rows exist.
2. **Trigger definitions** from `sharktank_db`: `SHOW TRIGGERS;` then `SHOW CREATE TRIGGER <name>;` for each, and `SHOW PROCEDURE STATUS WHERE Db='sharktank_db'; SHOW FUNCTION STATUS WHERE Db='sharktank_db';` — required before any trigger decision.
3. **Reference data names (non-sensitive):** `SELECT industry_id, industry_name, description FROM industry;` and `SELECT stage_id, stage_name FROM startup_stage;` — to seed them. Also `SELECT role_id, role_name FROM app_role;` to confirm the four role names match the seed exactly.
4. **Decision:** which database is the system of record — `sharktank_db` or the `…_test_full_20261023` clone.

## 9. Updated migration checklist
1. Verified backup of the target; record path/size.
2. Run `phase2_readonly_schema_inspection.sql` on the target; compare with section 2 above.
3. Fresh/disposable DB: `db:test:create` (baseline + 001 recorded) → `db:migrate -- --target test` (status). Migrations 002/003 are skipped as superseded; 004 is the only pending DRAFT. After review, apply 004 only to the guarded disposable test DB with explicit opt-in, then exercise publish/reject/history/concurrency checks.
4. Existing DB that already has the 001 objects: mark 001 yourself with `--mark-applied 001` after step 2 confirms it. This tool never does it automatically.
5. Never run `001` or the baseline on a database that already has those tables.
6. Change a draft to reviewed only by editing its `-- STATUS: DRAFT` header after teammate sign-off.
