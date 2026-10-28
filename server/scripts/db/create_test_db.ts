/**
 * Loads the reviewed baseline into a pre-created, EMPTY disposable test database.
 *
 * Provision the schema as a MySQL administrator first, then grant the test account
 * privileges only on that schema:
 *   CREATE DATABASE `sauda_test_local` CHARACTER SET utf8mb4;
 *   GRANT ALL PRIVILEGES ON `sauda_test_local`.* TO 'sauda_test_user'@'127.0.0.1';
 *
 * Then run:
 *   SAUDA_ALLOW_DESTRUCTIVE_TESTS=yes npm run db:test:create
 *
 * This script deliberately never CREATEs or DROPs databases. The test account therefore
 * does not need global CREATE/DROP privileges and cannot use this script to destroy other
 * schemas. To rebuild a test schema, an administrator must explicitly drop and recreate
 * only a verified `sauda_test_*` schema, then run this loader again.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { assertDisposableTestTarget, loadMigrations, planBaselineMarks, resolveTarget } from './lib.js';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = path.resolve(here, '../../../database/baseline');
const BASELINE_INFO_PATH = path.join(BASELINE_DIR, 'BASELINE_INFO.json');
const MIGRATIONS_DIR = path.resolve(here, '../../../database/migrations');
const TRACKING_SQL_PATH = path.resolve(here, '../../../database/schema_migrations.sql');

function fail(msg: string, code = 1): never {
  console.error(`[test-db] ${msg}`);
  process.exit(code);
}

async function main() {
  const target = resolveTarget('test', process.env);
  assertDisposableTestTarget(target, process.env);

  if (process.argv.includes('--recreate')) {
    return fail(
      'Refusing --recreate: this tool never drops databases. Have an administrator verify and recreate only the intended sauda_test_* database, then run the baseline loader again.',
    );
  }

  const baselineFiles = fs.existsSync(BASELINE_DIR)
    ? fs.readdirSync(BASELINE_DIR).filter((f) => /^\d+_.*\.sql$/.test(f)).sort()
    : [];
  if (baselineFiles.length === 0) {
    return fail(
      'BLOCKED: no reviewed baseline found in database/baseline/. A schema-only export of the real database is required before a test database can be built (see docs/phase-2-schema-reconciliation.md, section 5). Nothing was loaded.',
      3,
    );
  }

  // Connect directly to the one explicitly configured test schema. This requires only
  // schema-level privileges; it does not require global CREATE or DROP DATABASE.
  const conn = await mysql.createConnection({
    host: target.host,
    port: target.port,
    user: target.user,
    password: target.password,
    database: target.database,
    multipleStatements: true,
  });

  try {
    const [[db]] = await conn.query<RowDataPacket[]>('SELECT DATABASE() AS name');
    if (db.name !== target.database) {
      return fail(`Connected to "${db.name}", expected "${target.database}".`);
    }

    const [existing] = await conn.execute<RowDataPacket[]>(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = ? LIMIT 1',
      [target.database],
    );
    if (existing.length) {
      return fail(
        `Database ${target.database} is not empty (found at least one table/view). Nothing was changed. Use a new empty sauda_test_* database or have an administrator verify and recreate this test database before retrying.`,
      );
    }

    if (!fs.existsSync(BASELINE_INFO_PATH)) {
      return fail('BLOCKED: database/baseline/BASELINE_INFO.json is missing. Nothing was loaded.');
    }
    if (!fs.existsSync(TRACKING_SQL_PATH)) {
      return fail('BLOCKED: database/schema_migrations.sql is missing. Nothing was loaded.');
    }

    // Validate the baseline's migration claims before changing the empty schema.
    const baselineInfo = JSON.parse(fs.readFileSync(BASELINE_INFO_PATH, 'utf8')) as unknown;
    const migrations = loadMigrations(MIGRATIONS_DIR);
    const includedMigrations = planBaselineMarks(baselineInfo, migrations);

    for (const f of baselineFiles) {
      console.log(`[test-db] loading baseline ${f} into ${target.database}`);
      await conn.query(fs.readFileSync(path.join(BASELINE_DIR, f), 'utf8'));
    }

    // A baseline already contains the schema represented by these migrations. Record
    // that fact immediately so the next planner run cannot try to execute non-idempotent
    // migration DDL a second time. Use the migration file checksum, not the dump checksum.
    await conn.query(fs.readFileSync(TRACKING_SQL_PATH, 'utf8'));
    for (const migration of includedMigrations) {
      await conn.execute(
        `INSERT INTO schema_migrations
           (version, filename, checksum_sha256, status, applied_at, applied_by)
         VALUES (?, ?, ?, 'BASELINED', CURRENT_TIMESTAMP, ?)`,
        [migration.version, migration.filename, migration.checksum, os.userInfo().username],
      );
      console.log(`[test-db] recorded migration ${migration.version} (${migration.filename}) as BASELINED`);
    }

    console.log(`[test-db] baseline loaded and tracking initialized in ${target.database}. Next: npm run db:migrate -- --target test (review the plan before considering --apply).`);
    console.log('[test-db] No database was created or dropped by this script.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => fail(e?.message ?? String(e)));
