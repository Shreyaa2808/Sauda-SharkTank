# Database setup (Phase 2)

**State:** the baseline (41 tables, from a schema-only export of the test clone) and minimal role seed are in
`database/baseline/`. The baseline already contains migration 001. Migration 002 (`pitch.updated_at` / `pitch.review_note`)
and migration 003 (`user_saved_pitch` draft DDL) are superseded and skipped by the runner. Migration 004 adds the
Admin pitch-review event history and remains **DRAFT** until reviewed. Industry and startup-stage reference rows are
not seeded yet because their values were not supplied. Triggers/routines are not in the baseline (none were present
in the supplied export). See `docs/phase-2-schema-reconciliation.md` for evidence and open items.

## Layout
- `baseline/` — baseline schema, minimal role seed, and `BASELINE_INFO.json` (which migrations it contains)
- `migrations/` — ordered `NNN_name.sql` files; `_DRAFT` / `-- STATUS: DRAFT` remains review-only for the main database;
  `superseded.json` lists versions the runner must skip (currently 002 and 003)
- `schema_migrations.sql` — tracking table used by the runner
- `preflight/` — read-only inspection SQL

## Expected clean-test-database sequence

1. `npm run db:test:create` loads the baseline into an **empty disposable database** matching `sauda_test_[a-z0-9_]+`.
2. It records migration 001 as `BASELINED`, because the baseline already contains its objects.
3. Migration 002 and 003 appear as `SUPERSEDED (skipped)`; they are not pending and cannot be explicitly marked as applied.
4. Migration 004 is the only pending migration. It remains labelled `DRAFT` until reviewed. On a disposable test database only, the runner permits an explicitly opted-in `--apply` run so Phase 3 can be integration-tested without changing the draft label. **Do not apply it to the main database while it remains DRAFT.**
5. Inspect the resulting test schema and run the Admin-review integration journey before any separate approval to use the migration elsewhere.

## Commands (run from `server/`)

```bash
npm run db:migrate -- --list                         # offline: files, checksums, draft/superseded status
npm run test:dbtools                                 # static/unit tests; no DB connection
npm run db:migrate -- --target test                  # read-only status against TEST_DB_* after baseline creation
# Deliberate action: creates the empty disposable test DB from the reviewed baseline
SAUDA_ALLOW_DESTRUCTIVE_TESTS=yes npm run db:test:create
# Deliberate action: applies pending migration(s) only to TEST_DB_* after reviewing the status
SAUDA_ALLOW_DESTRUCTIVE_TESTS=yes npm run db:migrate -- --target test --apply
```

`server/test.env.example` documents `TEST_DB_*` configuration. On Windows PowerShell set the opt-in for that run:
`$env:SAUDA_ALLOW_DESTRUCTIVE_TESTS="yes"`.

Destructive actions only ever run on a database matching `sauda_test_[a-z0-9_]+`; `sharktank_db` and
`sharktank_db_test_full_20261023` are permanently refused. The database name must differ from `DB_NAME`, and the host
must be local unless remote testing is explicitly allowed. Migrations never run on server start. Never run the baseline
against an existing application database.
