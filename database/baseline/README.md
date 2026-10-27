# Baseline schema

- `001_baseline_schema.sql` — 41 `CREATE TABLE`s, schema only, generated from a `mysqldump --no-data` of the test clone
  `sharktank_db_test_full_20261023` (2026-10-27). Mechanical edits only (see the file header). Contains migration 001; not 002.
- `002_reference_seed.sql` — the four role names only. Industry/stage rows are intentionally absent (values not supplied).
- `BASELINE_INFO.json` — documents which numbered migrations the baseline contains; `db:test:create` records them as `BASELINED`.

Load only into an EMPTY disposable database (`npm run db:test:create`). Never run on an existing application database.
To refresh after a schema change: take a new schema-only export, regenerate, review the diff, and update `BASELINE_INFO.json`.
