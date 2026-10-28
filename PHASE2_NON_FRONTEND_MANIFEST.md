# Sauda — Phase 2 Non-Frontend Backend Bundle

**Purpose:** admin pitch review and moderation, role-management support, historical-data APIs, CSV import/reporting, role-specific profiles, and the remaining backend lifecycle corrections captured in the non-frontend audit.

**Archive type:** overlay bundle. Extract at the repository root. It does not contain frontend files, `.env` files, `node_modules`, build output, or a full copy of the repository.

## Included work

- Admin pitch-review queue/detail/decision and founder-visible review history.
- Draft migration `database/migrations/004_admin_pitch_review_DRAFT.sql` for append-only review history. It remains a DRAFT; do not apply it to the application database.
- A guarded MySQL integration test for review queue/detail/history, publish, rollback when history insert fails, and concurrent publish/reject decisions.
- Admin correction/archive routes for PLATFORM listings and admin role grant/revoke with last-admin protection and role audit entries.
- Historical read/search routes, admin historical CRUD, Shark-seat assignment, deal outcomes, comparison/statistics, bounded CSV import and retrievable import reports.
- Founder/investor role-specific profile APIs.
- Investor request withdrawal; request creation serialized against pitch archive; watchlist transaction/visibility guard; submission timestamp refresh on submit/resubmit; and consistent identifier/body validation in affected routes.
- The Phase 1 baseline tracking/test-fixture updates are included in overlapping files so the overlay retains the tested Phase 1 fixes.
- Test scripts retain `test:phase1` and add standard unit-suite, admin-review, CSV, and opt-in integration targets.

## Apply

1. Back up the current working tree or commit current work before overlaying files. The overlay intentionally replaces the listed backend files.
2. Extract this ZIP at the repository root, preserving the directory structure.
3. Install dependencies from the existing lockfile in `server/` (`npm ci`). Do not include or replace `.env`.
4. Run `npm run test:phase1`, `npm run test:admin-review`, `npm run test:historical-csv`, `npm run typecheck`, `npm run typecheck:scripts`, and `npm run build` from `server/`.
5. For the DB-backed admin-review integration test, use only a verified local disposable database named `sauda_test_*`. First inspect `npm run db:migrate -- --target test`. After reviewing the draft migration, use `SAUDA_ALLOW_DESTRUCTIVE_TESTS=yes npm run db:migrate -- --target test --apply` only when `TEST_DB_*` points at that disposable target. Then map `TEST_DB_*` to `DB_*` for the test command described in `docs/phase2-admin-review-and-moderation.md`.
6. Rerun the guarded workspace integration suite against a dedicated local API port other than `4000` after overlaying the latest `server/src/test_workspaces_security.ts`.

## Safety constraints

- Do not apply migration `004` to `sharktank_db` or any other application/authoritative database. The migration stays a draft pending authoritative read-only schema preflight, backup review, and explicit approval.
- Industry/stage names are not invented. The workspace integration test creates clearly labelled test-only reference rows only inside the explicitly opted-in disposable `sauda_test_*` database when none exist.
- Do not commit secrets, database credentials, `.env`, or generated `node_modules`/`dist` output.

## Validation status for this bundle

- 18 backend TypeScript files passed a syntax/transpile diagnostic sweep in the packaging environment.
- 36 database-tool/admin-review/CSV parser unit tests passed when transpiled and run in an isolated copy of the project (23 database-tool/baseline checks, 9 admin-review unit tests, and 4 CSV parser tests).
- A full `npm run typecheck` attempt in this packaging environment failed because the extracted `node_modules` tree was incomplete (missing `@types` entries). A full dependency-backed build and the new MySQL admin-review integration test could not be verified here because dependency installation did not complete and no MySQL instance was available. Run those checks on the developer Mac before committing.
- The earlier user-run workspace integration suite passed 46/46 before the final safety-guard/test cleanup changes; it needs to be rerun after this overlay with the dedicated API target and test DB.

This bundle is not a claim that verified historical Shark Tank reference data has been imported, or that migration `004` is approved for production.
