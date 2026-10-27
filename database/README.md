# Database setup (Phase 2)

**State:** the baseline (41 tables, from a schema-only export of the test clone) and a minimal role seed are in
`database/baseline/`. It already contains migration 001. Industry and startup-stage reference rows are NOT seeded yet
(values not supplied). Triggers/routines are NOT in the baseline (none in the export). See
`docs/phase-2-schema-reconciliation.md` for evidence and open items. No SQL has been executed against any database by this tooling's authors.

## Layout
- `baseline/` — baseline schema, minimal role seed, `BASELINE_INFO.json` (which migrations it contains)
- `migrations/` — ordered `NNN_name.sql`; `_DRAFT` / `-- STATUS: DRAFT` files are review-only; `superseded.json` lists skipped numbers (003)
- `schema_migrations.sql` — tracking table used by the runner
- `preflight/` — read-only inspection SQL

## Commands (run from `server/`)
```
npm run db:migrate -- --list                         # offline: files, checksums, draft flags
npm run db:migrate                                   # status against DB_* (read-only)
# disposable test database (see server/test.env.example; opt-in per run):
SAUDA_ALLOW_DESTRUCTIVE_TESTS=yes npm run db:test:create
SAUDA_ALLOW_DESTRUCTIVE_TESTS=yes npm run db:migrate -- --target test --apply
npm run test:dbtools                                 # unit tests for the guard and planner (no DB needed)
```
On Windows PowerShell set the variable first: `$env:SAUDA_ALLOW_DESTRUCTIVE_TESTS="yes"`.
Destructive actions only ever run on a database matching `sauda_test_[a-z0-9_]+`; `sharktank_db` and
`sharktank_db_test_full_20261023` are permanently refused. Migrations never run on server start.
