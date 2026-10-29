/**
 * Ordered, tracked migration runner.
 *
 *   npm run db:migrate -- --list                      offline: list files, checksums, draft status (no DB)
 *   npm run db:migrate                                 status: read-only report against DB_* (default target)
 *   npm run db:migrate -- --target test --apply       apply pending migrations to the disposable TEST database
 *   npm run db:migrate -- --apply --confirm-db NAME   apply REVIEWED (non-draft) migrations to the main DB
 *   npm run db:migrate -- --mark-applied 001 --confirm-db NAME
 *                                                      record a migration that was already applied by hand
 *
 * Nothing here runs automatically on server start. Default mode never writes.
 */
import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import {
  assertDisposableTestTarget,
  assertMigrationCanBeMarked,
  loadMigrations,
  planMigrations,
  resolveTarget,
  type AppliedRow,
  type DbTarget,
} from './lib.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(here, '../../../database/migrations');
const TRACKING_SQL = path.resolve(here, '../../../database/schema_migrations.sql');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function fail(msg: string, code = 1): never {
  console.error(`\n[migrate] ${msg}`);
  process.exit(code);
}

async function main() {
  const files = loadMigrations(MIGRATIONS_DIR);

  if (flag('list')) {
    console.log('Version  Draft  Checksum (sha256, first 12)  File');
    for (const f of files) console.log(`${f.version.padEnd(8)} ${(f.superseded ? 'SUPERS.' : f.isDraft ? 'DRAFT' : 'ok').padEnd(6)} ${f.checksum.slice(0, 12).padEnd(28)} ${f.filename}`);
    return;
  }

  // Refuse invalid/superseded explicit marks before opening any DB connection or creating the tracking table.
  const markVersion = arg('mark-applied');
  if (markVersion !== undefined) {
    const candidate = files.find((x) => x.version === markVersion);
    if (!candidate) return fail(`No migration file with version ${markVersion}.`);
    try {
      assertMigrationCanBeMarked(candidate);
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  const kind = (arg('target') ?? 'main') as 'main' | 'test';
  if (kind !== 'main' && kind !== 'test') fail('--target must be "main" or "test".');
  const apply = flag('apply');
  const writing = apply || markVersion !== undefined;

  let target: DbTarget;
  try {
    target = resolveTarget(kind, process.env);
  } catch (e) {
    return fail((e as Error).message);
  }

  if (writing) {
    if (kind === 'test') {
      try {
        assertDisposableTestTarget(target, process.env);
      } catch (e) {
        return fail((e as Error).message);
      }
    } else if (arg('confirm-db') !== target.database) {
      return fail(`Writing to the main database requires --confirm-db ${target.database} (typed exactly).`);
    }
  }

  console.log(`[migrate] target=${kind} host=${target.host}:${target.port} database=${target.database} mode=${writing ? (apply ? 'APPLY' : 'MARK') : 'status (read-only)'}`);

  const conn = await mysql.createConnection({
    host: target.host,
    port: target.port,
    user: target.user,
    password: target.password,
    database: target.database,
    multipleStatements: apply, // only the apply path executes whole files
  });

  try {
    const [[db]] = await conn.query<RowDataPacket[]>('SELECT DATABASE() AS name');
    if (db.name !== target.database) fail(`Connected to "${db.name}", expected "${target.database}".`);

    const [[lock]] = await conn.query<RowDataPacket[]>("SELECT GET_LOCK('sauda_schema_migrate', 0) AS got");
    if (lock.got !== 1) fail('Another migration run holds the lock.');

    if (writing) await conn.query(fs.readFileSync(TRACKING_SQL, 'utf8'));

    const [tbl] = await conn.query<RowDataPacket[]>(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'schema_migrations'",
    );
    let applied: AppliedRow[] = [];
    if (tbl.length) {
      const [rows] = await conn.query<RowDataPacket[]>('SELECT version, checksum_sha256, status FROM schema_migrations');
      applied = rows as AppliedRow[];
    } else {
      console.log('[migrate] schema_migrations does not exist yet (nothing is tracked on this database).');
    }

    const plan = planMigrations(files, applied);
    for (const f of files) {
      const a = applied.find((x) => x.version === f.version);
      console.log(`  ${f.version} ${f.filename}  ${f.superseded ? 'SUPERSEDED (skipped)' : a ? a.status : 'PENDING'}${f.isDraft && !f.superseded ? '  [DRAFT]' : ''}`);
    }
    if (plan.problems.length) fail(`Stopped:\n - ${plan.problems.join('\n - ')}`);

    if (markVersion !== undefined) {
      const f = files.find((x) => x.version === markVersion)!;
      if (applied.some((a) => a.version === f.version)) return fail(`${f.version} is already recorded.`);
      await conn.execute(
        "INSERT INTO schema_migrations (version, filename, checksum_sha256, status, applied_at, applied_by) VALUES (?, ?, ?, 'BASELINED', CURRENT_TIMESTAMP, ?)",
        [f.version, f.filename, f.checksum, os.userInfo().username],
      );
      console.log(`[migrate] Recorded ${f.filename} as BASELINED. This does NOT verify the schema; confirm it with database/preflight first.`);
      return;
    }

    if (!apply) {
      console.log(`\n[migrate] ${plan.pending.length} pending. Nothing was changed (status mode).`);
      return;
    }

    const drafts = plan.pending.filter((f) => f.isDraft);
    if (kind === 'main' && drafts.length) {
      return fail(
        `Refusing to apply DRAFT migration(s) to the main database: ${drafts.map((d) => d.filename).join(', ')}.\n` +
          'Review them against the verified schema first, then change the "-- STATUS: DRAFT" header (and drop the _DRAFT suffix) to mark them reviewed.',
      );
    }

    for (const f of plan.pending) {
      console.log(`[migrate] applying ${f.filename} ...`);
      await conn.execute(
        "INSERT INTO schema_migrations (version, filename, checksum_sha256, status, applied_by) VALUES (?, ?, ?, 'APPLYING', ?)",
        [f.version, f.filename, f.checksum, os.userInfo().username],
      );
      try {
        await conn.query(f.sql);
      } catch (e: any) {
        console.error(`[migrate] FAILED in ${f.filename}: ${e.code ?? ''} ${e.sqlMessage ?? e.message}`);
        console.error('[migrate] DDL cannot be rolled back. The migration stays marked APPLYING so nothing else runs until you inspect the schema.');
        process.exitCode = 1;
        return;
      }
      await conn.execute("UPDATE schema_migrations SET status = 'APPLIED', applied_at = CURRENT_TIMESTAMP WHERE version = ?", [f.version]);
      console.log(`[migrate] applied ${f.filename}`);
    }
    console.log('[migrate] done.');
  } finally {
    try {
      await conn.query("SELECT RELEASE_LOCK('sauda_schema_migrate')");
    } catch {
      /* connection already closed */
    }
    await conn.end();
  }
}

main().catch((e) => fail(e?.message ?? String(e)));
