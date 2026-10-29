# Safe local test database setup

This setup is only for a local, disposable `sauda_test_*` database. The test account must not have global `CREATE DATABASE` or `DROP DATABASE` privileges. The baseline loader expects the target database to be pre-created and empty. It never creates or drops a database.

## 1. Provision the disposable database once

Using MySQL Workbench with a MySQL administrator account, verify that `sauda_test_local` is not used by another project before creating it. If the name already exists, do not drop it; choose a new name matching `sauda_test_[a-z0-9_]+` and update `TEST_DB_NAME` in `server/.env`.

```sql
CREATE DATABASE `sauda_test_local` CHARACTER SET utf8mb4;
GRANT ALL PRIVILEGES ON `sauda_test_local`.* TO 'sauda_test_user'@'127.0.0.1';
SHOW GRANTS FOR 'sauda_test_user'@'127.0.0.1';
```

Keep grants scoped to that schema. Do not grant global `CREATE` or `DROP` privileges. Set the `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD`, and `TEST_DB_NAME` variables in `server/.env`. Do not change the existing `DB_*` variables for normal development.

## 2. Load the baseline and initialize migration history

From `server/`:

```bash
SAUDA_ALLOW_DESTRUCTIVE_TESTS=yes npm run db:test:create
npm run db:migrate -- --target test
```

The baseline loader refuses any database containing tables/views. It validates `BASELINE_INFO.json` before loading the SQL files, creates the migration-tracking table, and records each migration declared in `includesMigrations` as `BASELINED`, with the checksum of the corresponding migration file. This stops migration `001` from being proposed for a second execution against schema that already includes it.

The read-only planner should show version `001` as `BASELINED`, versions `002` and `003` as superseded, and version `004` as a pending draft. **Do not apply migration `004` as part of Phase 1.** A baseline load uses MySQL DDL and cannot be treated as one rollbackable transaction. If a run fails after partially loading schema, stop and have an administrator inspect the disposable schema before deciding how to rebuild it. Do not use `--recreate`; the tool intentionally refuses to drop schemas.

Never target `sharktank_db` or `sharktank_db_test_full_20261023` with the test tooling.

## 3. Phase 1 checks

```bash
npm run test:phase1
```

This runs the database tooling typecheck and static/unit tests; it does not connect to MySQL or mutate a database.

## 4. Workspace integration test (explicit opt-in only)

The workspace test changes data. Run it only when both the test runner and API server use the same verified disposable `sauda_test_*` database. The test requires `SAUDA_RUN_WORKSPACE_SECURITY_TESTS=1` and an explicit `SAUDA_TEST_API_BASE` URL targeting a local `/api` endpoint on a port other than `4000`. The test refuses a missing API URL or port `4000` before issuing requests.

A clean baseline intentionally does **not** invent the application's real industry/stage taxonomy. If the disposable test database has empty `industry` and `startup_stage` tables, the workspace integration suite inserts one clearly named test-only fixture in each table and resolves the generated IDs dynamically. These fixture labels are for test use only and must not be treated as production taxonomy values.

The test cleanup removes its exactly named test pitch and dependent lifecycle rows after success and on handled failures. The three explicitly named `@sauda.test` identities and their assigned roles are intentionally reused between runs rather than removed. Reference rows may remain as one stable fixture each in the disposable database; they are not production seed data.
