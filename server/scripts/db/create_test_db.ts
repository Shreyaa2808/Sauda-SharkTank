/**
 * Creates (or, with --recreate, rebuilds) the DISPOSABLE test database from the reviewed baseline.
 *
 *   SAUDA_ALLOW_DESTRUCTIVE_TESTS=yes npm run db:test:create [-- --recreate]
 *
 * Uses only TEST_DB_* settings (see server/test.env.example). It can never act on DB_NAME,
 * sharktank_db, or any name outside ^sauda_test_[a-z0-9_]+$.
 * It refuses to run until a genuine baseline exists in database/baseline/ (see database/README.md).
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import os from 'node:os';
import { assertDisposableTestTarget, loadMigrations, planBaselineMarks, resolveTarget } from './lib.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = path.resolve(here, '../../../database/baseline');
const MIGRATIONS_DIR = path.resolve(here, '../../../database/migrations');
const TRACKING_SQL = path.resolve(here, '../../../database/schema_migrations.sql');

function fail(msg: string, code = 1): never {
  console.error(`[test-db] ${msg}`);
  process.exit(code);
}

async function main() {
  const target = resolveTarget('test', process.env);
  assertDisposableTestTarget(target, process.env);

  const baselineFiles = fs.existsSync(BASELINE_DIR)
    ? fs.readdirSync(BASELINE_DIR).filter((f) => /^\d+_.*\.sql$/.test(f)).sort()
    : [];
  if (baselineFiles.length === 0) {
    return fail(
      'BLOCKED: no reviewed baseline found in database/baseline/. A schema-only export of the real database is required\n' +
        '         before a test database can be built (see docs/phase-2-schema-reconciliation.md, section 5). Nothing was created.',
      3,
    );
  }

  const admin = await mysql.createConnection({
    host: target.host, port: target.port, user: target.user, password: target.password, multipleStatements: true,
  });
  try {
    const [exists] = await admin.query<RowDataPacket[]>('SELECT 1 FROM information_schema.schemata WHERE schema_name = ?', [target.database]);
    if (exists.length) {
      if (!process.argv.includes('--recreate')) return fail(`Database ${target.database} already exists. Pass --recreate to drop and rebuild it.`);
      assertDisposableTestTarget(target, process.env); // re-check immediately before the only DROP in this codebase
      await admin.query(`DROP DATABASE \`${target.database}\``);
      console.log(`[test-db] dropped ${target.database}`);
    }
    await admin.query(`CREATE DATABASE \`${target.database}\` CHARACTER SET utf8mb4`);
    await admin.query(`USE \`${target.database}\``);
    for (const f of baselineFiles) {
      console.log(`[test-db] loading baseline ${f}`);
      await admin.query(fs.readFileSync(path.join(BASELINE_DIR, f), 'utf8'));
    }

    // Record the migrations the baseline is documented to contain (BASELINE_INFO.json), visibly.
    const infoPath = path.join(BASELINE_DIR, 'BASELINE_INFO.json');
    if (fs.existsSync(infoPath)) {
      const marks = planBaselineMarks(JSON.parse(fs.readFileSync(infoPath, 'utf8')), loadMigrations(MIGRATIONS_DIR));
      await admin.query(fs.readFileSync(TRACKING_SQL, 'utf8'));
      for (const f of marks) {
        await admin.query(
          "INSERT INTO schema_migrations (version, filename, checksum_sha256, status, applied_at, applied_by) VALUES (?, ?, ?, 'BASELINED', CURRENT_TIMESTAMP, ?)",
          [f.version, f.filename, f.checksum, os.userInfo().username],
        );
        console.log(`[test-db] recorded ${f.filename} as BASELINED (documented in BASELINE_INFO.json)`);
      }
    } else {
      console.log('[test-db] no BASELINE_INFO.json: no migrations were recorded; record any included ones with --mark-applied.');
    }
    console.log('[test-db] baseline loaded. Next: npm run db:migrate -- --target test   (add --apply to run pending migrations).');
  } finally {
    await admin.end();
  }
}

main().catch((e) => fail(e?.message ?? String(e)));
