# Baseline schema

- `001_baseline_schema.sql` — 41 `CREATE TABLE`s, schema only, generated from a `mysqldump --no-data` of the test clone
  `sharktank_db_test_full_20261023` (2026-10-27). Mechanical edits only (see the file header). Contains migration 001;
  it does not contain migration 002's `pitch.updated_at` / `pitch.review_note` columns.
- `002_reference_seed.sql` — the four role names only. Industry/stage rows are intentionally absent (values not supplied).
- `BASELINE_INFO.json` — documents which numbered migrations the baseline contains; `db:test:create` records migration 001 as `BASELINED`.

## Expected migration sequence after loading the baseline

1. The baseline schema is loaded into an empty disposable test database.
2. `BASELINE_INFO.json` causes migration 001 to be recorded as `BASELINED`, because its objects are already present.
3. Migrations 002 and 003 are listed in `database/migrations/superseded.json`; the migration runner skips them and refuses manual `--mark-applied` for them. Their source files remain for historical reference.
4. Migration 004 (`pitch_review_event`) is the only pending migration. It remains marked DRAFT. The runner may apply it explicitly to a guarded disposable `sauda_test_*` database for integration testing, but refuses to apply it to the main database while it remains DRAFT.

Load this baseline only into an EMPTY disposable database (`npm run db:test:create`). Never run on an existing application database.
To refresh after a schema change: take a new schema-only export, regenerate, review the diff, and update `BASELINE_INFO.json`.
