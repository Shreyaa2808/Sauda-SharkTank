# Sauda Phase 2 → Phase 3 migration readiness patch

## Purpose

This patch reconciles migration ordering ahead of Phase 3 integration testing. It identifies migration 002 as superseded, preserves the original draft SQL file unchanged, ensures superseded migrations are skipped by planning and rejected before a database connection when someone tries to mark one as applied, and documents the intended clean-test sequence.

## Migration decisions

- **001** remains part of the baseline and is recorded as `BASELINED` by `database/baseline/BASELINE_INFO.json` when a new disposable test database is created.
- **002** remains in `database/migrations/002_founder_pitch_review_fields_DRAFT.sql` unchanged for historical reference, but is now listed in `database/migrations/superseded.json`. Static inspection found no runtime consumer of `pitch.updated_at` or `pitch.review_note`; the current review workflow uses `pitch_review_event`.
- **003** remains superseded because `user_saved_pitch` already exists in the supplied schema export.
- **004** remains marked `DRAFT`. After the team reviews the migration, it is the only pending migration for the isolated disposable test database. It is not approved for or applied to the main database by this patch.

## Changed files

- `database/migrations/superseded.json`
- `database/README.md`
- `database/baseline/README.md`
- `docs/phase-2-schema-reconciliation.md`
- `docs/admin-pitch-review-workflow.md`
- `server/scripts/db/lib.ts`
- `server/scripts/db/migrate.ts`
- `server/scripts/db/lib.test.ts`
- `server/scripts/db/baseline.test.ts`

## Safety

- No SQL was executed.
- No database connection was opened.
- No database schema, data, or environment secrets were modified.
- Migration 002's original draft file and migration 004's DRAFT marker remain unchanged.

## Verification performed in this environment

- 22 database-tool/baseline tests passed through a temporary Node test harness after syntax-transpiling the TypeScript test sources with the globally available TypeScript compiler API.
- Syntax transpilation passed for `lib.ts`, `lib.test.ts`, `baseline.test.ts`, and `migrate.ts`.
- JSON parsing and ZIP integrity checks passed.
- A normal `npm run typecheck` could not complete in this container because the uploaded `node_modules` directories lack their package files/type definitions. Run the standard commands in the local project where dependencies are installed:

```bash
cd server
npm run test:dbtools
npm run test:admin-review
npm run typecheck
```

No live MySQL integration test has been run. The next database step must use only the guarded disposable `sauda_test_*` target, with an explicit opt-in, after reviewing the migration status and current schema.
