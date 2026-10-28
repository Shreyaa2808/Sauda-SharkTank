/**
 * Sauda Phase 6: Clean-Database Bootstrap Verification Test
 * Workstream B: Validates that a fresh, empty disposable database can be initialized
 * in a single pass, that baseline tables and reference seeds load, and that the migration
 * tracker accurately records the baseline without reapplying DDL.
 *
 * Safety Rules:
 * - Never drops or repurposes an existing populated database.
 * - Verifies connected schema before any write.
 * - If an empty schema is not provisioned or permissions are restricted, reports
 *   a clear prerequisite block rather than failing destructively.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import {
  loadMigrations,
  planBaselineMarks,
  planMigrations,
  type AppliedRow,
} from './lib.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = path.resolve(here, '../../../database/baseline');
const BASELINE_INFO_PATH = path.join(BASELINE_DIR, 'BASELINE_INFO.json');
const MIGRATIONS_DIR = path.resolve(here, '../../../database/migrations');
const TRACKING_SQL_PATH = path.resolve(here, '../../../database/schema_migrations.sql');

const PROTECTED_DATABASES = [
  'sharktank_db',
  'sharktank_db_test_full_20261023',
  'information_schema',
  'mysql',
  'performance_schema',
  'sys',
];

test('Sauda Phase 6: Clean-Database Bootstrap Verification', async (t) => {
  const enabled = process.env.SAUDA_RUN_CLEAN_BOOTSTRAP_TEST === '1';
  if (!enabled) {
    t.skip('Opt-in required via SAUDA_RUN_CLEAN_BOOTSTRAP_TEST=1.');
    return;
  }

  const targetDbName = (process.env.CLEAN_TEST_DB_NAME ?? process.env.DB_NAME ?? '').trim();
  if (!targetDbName) {
    t.skip('PREREQUISITE BLOCKED: Target database name must be specified via CLEAN_TEST_DB_NAME or DB_NAME.');
    return;
  }

  // Safety checks
  if (PROTECTED_DATABASES.includes(targetDbName.toLowerCase())) {
    throw new Error(`[SAFETY VIOLATION] Target database '${targetDbName}' is protected.`);
  }

  if (targetDbName.toLowerCase() === 'sauda_test_phase3') {
    t.skip(
      'PREREQUISITE BLOCKED: sauda_test_phase3 is a populated fixture database and must not be used for clean bootstrap verification. A dedicated empty schema (e.g. sauda_test_clean) is required.',
    );
    return;
  }

  const isDisposable = /^sauda_test_[a-z0-9_]{1,40}$/i.test(targetDbName);
  if (!isDisposable) {
    throw new Error(`[SAFETY VIOLATION] Target '${targetDbName}' does not match sauda_test_* disposable pattern.`);
  }

  const host = (process.env.TEST_DB_HOST ?? process.env.DB_HOST ?? '127.0.0.1').trim().toLowerCase();
  const user = (process.env.TEST_DB_USER ?? process.env.DB_USER ?? 'sauda_test_user').trim();
  const password = process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '';
  const port = Number(process.env.TEST_DB_PORT ?? process.env.DB_PORT ?? 3306);

  let conn: mysql.Connection;
  try {
    conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database: targetDbName,
      multipleStatements: true,
    });
  } catch (err: any) {
    t.skip(
      `PREREQUISITE BLOCKED: Unable to connect to '${targetDbName}' (${err?.code ?? err?.message}). ` +
      `Have an administrator provision an empty schema in MySQL Workbench: ` +
      `CREATE DATABASE \`${targetDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; ` +
      `GRANT ALL PRIVILEGES ON \`${targetDbName}\`.* TO '${user}'@'${host}';`,
    );
    return;
  }

  try {
    // 1. Verify connected database identity
    const [[dbRow]] = await conn.query<RowDataPacket[]>('SELECT DATABASE() AS currentDb');
    assert.equal(
      String(dbRow.currentDb).toLowerCase(),
      targetDbName.toLowerCase(),
      `Must be connected to target database '${targetDbName}'`,
    );

    // 2. Check if the database is genuinely empty
    const [existingTables] = await conn.execute<RowDataPacket[]>(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
      [targetDbName],
    );

    if (existingTables.length > 0) {
      t.skip(
        `PREREQUISITE BLOCKED: Database '${targetDbName}' is not empty (contains ${existingTables.length} tables). ` +
        `Clean-database bootstrap verification requires a freshly provisioned, blank schema. ` +
        `Do not drop populated fixture databases.`,
      );
      return;
    }

    // 3. Load baseline schema files in order
    const baselineFiles = fs.existsSync(BASELINE_DIR)
      ? fs.readdirSync(BASELINE_DIR).filter((f) => /^\d+_.*\.sql$/.test(f)).sort()
      : [];
    assert(baselineFiles.length > 0, 'Baseline directory contains migration files');

    for (const f of baselineFiles) {
      const sql = fs.readFileSync(path.join(BASELINE_DIR, f), 'utf8');
      await conn.query(sql);
    }

    // 4. Create migration tracking table and mark baseline migrations
    const trackingSql = fs.readFileSync(TRACKING_SQL_PATH, 'utf8');
    await conn.query(trackingSql);

    const baselineInfo = JSON.parse(fs.readFileSync(BASELINE_INFO_PATH, 'utf8'));
    const migrations = loadMigrations(MIGRATIONS_DIR);
    const included = planBaselineMarks(baselineInfo, migrations);

    for (const m of included) {
      await conn.execute(
        `INSERT INTO schema_migrations
           (version, filename, checksum_sha256, status, applied_at, applied_by)
         VALUES (?, ?, ?, 'BASELINED', CURRENT_TIMESTAMP, NULL)`,
        [m.version, m.filename, m.checksum],
      );
    }

    // 5. Verify all tables exist and reference seed data is present
    const [loadedTables] = await conn.execute<RowDataPacket[]>(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
      [targetDbName],
    );
    assert(loadedTables.length >= 41, 'Baseline should load at least 41 InnoDB tables');

    const [roles] = await conn.execute<RowDataPacket[]>('SELECT role_name FROM app_role ORDER BY role_id');
    const roleNames = roles.map((r) => r.role_name);
    assert.deepEqual(roleNames, ['VIEWER', 'FOUNDER', 'INVESTOR', 'ADMIN'], 'Default app_role records are seeded');

    // 6. Test migration planner: verify baseline migrations are NOT reapplied
    const [appliedRows] = await conn.execute<RowDataPacket[]>('SELECT version, checksum_sha256, status FROM schema_migrations');
    const plan = planMigrations(migrations, appliedRows as AppliedRow[]);

    assert.equal(plan.problems.length, 0, 'Plan should contain no blocking problems');
    assert.equal(plan.pending.length, 1, 'Only draft migration 004 should be pending');
    assert.equal(plan.pending[0].version, '004', 'Pending migration is 004');
    assert.equal(plan.pending[0].isDraft, true, 'Migration 004 is marked as draft');
  } finally {
    await conn.end().catch(() => undefined);
  }
});
