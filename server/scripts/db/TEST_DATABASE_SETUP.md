# Safe local test database setup

The test account must not receive global `CREATE` or `DROP` privileges. The baseline loader now expects the database to be pre-created and empty.

## One-time provisioning (MySQL Workbench, connected as a MySQL administrator)

Verify that `sauda_test_local` is not already used by another project. If it is already present, do not drop it; choose a new name matching `sauda_test_[a-z0-9_]+` and update `TEST_DB_NAME` in `server/.env`.

```sql
CREATE DATABASE `sauda_test_local` CHARACTER SET utf8mb4;
GRANT ALL PRIVILEGES ON `sauda_test_local`.* TO 'sauda_test_user'@'127.0.0.1';
SHOW GRANTS FOR 'sauda_test_user'@'127.0.0.1';
```

Expected grants include `USAGE ON *.*` and schema-scoped privileges on `sauda_test_local`.*. Do not grant `ALL PRIVILEGES ON *.*`.

## Build the baseline (Terminal, from `server/`)

Ensure `server/.env` contains the `TEST_DB_*` variables and that `TEST_DB_NAME=sauda_test_local`. Keep the existing `DB_*` variables untouched. Set the opt-in only for this command:

```bash
SAUDA_ALLOW_DESTRUCTIVE_TESTS=yes npm run db:test:create
```

The loader only operates on the configured test schema, requires it to be empty, and never creates or drops a database. If it reports that the schema is not empty, stop. Do not add `--recreate`; the tool refuses it by design.

After the baseline is loaded, inspect the migration plan before considering any draft application:

```bash
npm run db:migrate -- --target test
```

Do not use `--apply` until the plan, schema, and migration `004` have been reviewed. Never target `sharktank_db` or `sharktank_db_test_full_20261023` with the test tooling.
