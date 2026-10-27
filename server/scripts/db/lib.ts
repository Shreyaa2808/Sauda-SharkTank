import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Safety guard for destructive database work
// ---------------------------------------------------------------------------

/** The only schema names that destructive tooling may ever touch. */
export const TEST_DB_NAME_PATTERN = /^sauda_test_[a-z0-9_]{1,40}$/;

/** Names that are refused even if someone edits the pattern above by mistake. */
export const PROTECTED_DB_NAMES = [
  'sharktank_db',
  'sharktank_db_test_full_20261023',
  'mysql',
  'sys',
  'information_schema',
  'performance_schema',
];

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export interface DbTarget {
  kind: 'main' | 'test';
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** Returns a problem description, or null if the name is acceptable for a disposable test DB. */
export function validateDisposableTestDbName(name: string | undefined): string | null {
  if (!name) return 'TEST_DB_NAME is not set.';
  const lower = name.toLowerCase();
  if (PROTECTED_DB_NAMES.includes(lower)) return `"${name}" is a protected database and can never be a test target.`;
  if (!TEST_DB_NAME_PATTERN.test(name)) {
    return `"${name}" is not an approved test database name (must match ${TEST_DB_NAME_PATTERN}).`;
  }
  return null;
}

/**
 * Throws unless this target is explicitly a disposable test database AND the caller opted in.
 * Used before any create/drop/apply-draft operation.
 */
export function assertDisposableTestTarget(target: DbTarget, env: NodeJS.ProcessEnv): void {
  if (target.kind !== 'test') throw new Error('Refusing: destructive action requested against a non-test target.');
  const nameProblem = validateDisposableTestDbName(target.database);
  if (nameProblem) throw new Error(`Refusing: ${nameProblem}`);
  if (env.DB_NAME && env.DB_NAME.toLowerCase() === target.database.toLowerCase()) {
    throw new Error('Refusing: TEST_DB_NAME is identical to DB_NAME (the application database).');
  }
  if (env.SAUDA_ALLOW_DESTRUCTIVE_TESTS !== 'yes') {
    throw new Error('Refusing: set SAUDA_ALLOW_DESTRUCTIVE_TESTS=yes to explicitly enable destructive test actions.');
  }
  if (!LOCAL_HOSTS.has(target.host.toLowerCase()) && env.SAUDA_TEST_DB_ALLOW_REMOTE !== 'yes') {
    throw new Error(
      `Refusing: test database host "${target.host}" is not local. Set SAUDA_TEST_DB_ALLOW_REMOTE=yes only if that is intended.`,
    );
  }
}

/** Reads connection settings from env. Reports missing variable NAMES only, never values. */
export function resolveTarget(kind: 'main' | 'test', env: NodeJS.ProcessEnv): DbTarget {
  const prefix = kind === 'test' ? 'TEST_DB_' : 'DB_';
  const need = ['HOST', 'USER', 'PASSWORD', 'NAME'].map((k) => prefix + k);
  const missing = need.filter((k) => env[k] === undefined || env[k] === '');
  // An empty password is legitimate for some local setups, so only require the variable to exist.
  const reallyMissing = missing.filter((k) => !(k.endsWith('PASSWORD') && env[k] === ''));
  if (reallyMissing.length) throw new Error(`Missing environment variable(s): ${reallyMissing.join(', ')}`);
  const port = Number(env[prefix + 'PORT'] ?? '3306');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${prefix}PORT must be a valid port number.`);
  return {
    kind,
    host: env[prefix + 'HOST'] as string,
    port,
    user: env[prefix + 'USER'] as string,
    password: env[prefix + 'PASSWORD'] ?? '',
    database: env[prefix + 'NAME'] as string,
  };
}

// ---------------------------------------------------------------------------
// Migration files
// ---------------------------------------------------------------------------

export interface MigrationFile {
  version: string;
  name: string;
  filename: string;
  fullPath: string;
  checksum: string;
  isDraft: boolean;
  /** Reason text when listed in database/migrations/superseded.json; such files are never run. */
  superseded?: string;
  sql: string;
}

const MIGRATION_NAME = /^(\d{3,6})_([A-Za-z0-9_]+)\.sql$/;

/** A migration is a draft if its name ends in _DRAFT or its header says "-- STATUS: DRAFT". */
export function isDraftMigration(filename: string, sql: string): boolean {
  return /_DRAFT\.sql$/i.test(filename) || /^--\s*STATUS:\s*DRAFT/im.test(sql);
}

export function checksumOf(sql: string): string {
  // Normalise line endings so a Windows checkout and a macOS checkout produce the same checksum.
  return crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/** Reads database/migrations/superseded.json ({ "003": "reason" }). Missing file => none. */
export function loadSuperseded(dir: string): Record<string, string> {
  const p = path.join(dir, 'superseded.json');
  if (!fs.existsSync(p)) return {};
  const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [k, v] of Object.entries(parsed)) {
    if (!/^\d{3,6}$/.test(k) || typeof v !== 'string' || !v.trim()) {
      throw new Error(`superseded.json: entry "${k}" must be a version mapped to a non-empty reason.`);
    }
  }
  return parsed as Record<string, string>;
}

export function loadMigrations(dir: string): MigrationFile[] {
  const superseded = loadSuperseded(dir);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql'));
  const out: MigrationFile[] = [];
  const seen = new Map<string, string>();
  for (const filename of files.sort()) {
    const m = MIGRATION_NAME.exec(filename);
    if (!m) throw new Error(`Migration file name not recognised (expected NNN_description.sql): ${filename}`);
    const version = m[1];
    if (seen.has(version)) throw new Error(`Duplicate migration version ${version}: ${seen.get(version)} and ${filename}`);
    seen.set(version, filename);
    const fullPath = path.join(dir, filename);
    const sql = fs.readFileSync(fullPath, 'utf8');
    out.push({
      version, name: m[2], filename, fullPath, checksum: checksumOf(sql),
      isDraft: isDraftMigration(filename, sql), superseded: superseded[version], sql,
    });
  }
  for (const v of Object.keys(superseded)) {
    if (!seen.has(v)) throw new Error(`superseded.json lists version ${v} but no such migration file exists.`);
  }
  return out.sort((a, b) => Number(a.version) - Number(b.version));
}

export interface AppliedRow {
  version: string;
  checksum_sha256: string;
  status: 'APPLYING' | 'APPLIED' | 'BASELINED';
}

export interface MigrationPlan {
  pending: MigrationFile[];
  problems: string[];
}

/** Pure planning step (unit-testable): decides what may run and what must stop the run. */
export function planMigrations(files: MigrationFile[], applied: AppliedRow[]): MigrationPlan {
  const problems: string[] = [];
  const byVersion = new Map(applied.map((a) => [a.version, a]));
  const known = new Set(files.map((f) => f.version));

  for (const a of applied) {
    if (!known.has(a.version)) problems.push(`schema_migrations has version ${a.version} but no matching file exists.`);
    if (a.status === 'APPLYING') {
      problems.push(
        `Migration ${a.version} is marked APPLYING: a previous run did not finish. It may be PARTIALLY applied. ` +
          'Inspect the schema by hand (SHOW CREATE TABLE ...) and resolve it before running again.',
      );
    }
  }
  for (const f of files) {
    const a = byVersion.get(f.version);
    if (a && a.status === 'APPLIED' && !f.superseded && a.checksum_sha256 !== f.checksum) {
      problems.push(`Migration ${f.filename} was changed after it was applied (checksum mismatch). Applied migrations are immutable; add a new migration instead.`);
    }
  }
  const pending = files.filter((f) => !byVersion.has(f.version) && !f.superseded);
  const highestApplied = Math.max(-1, ...applied.map((a) => Number(a.version)));
  for (const f of pending) {
    if (Number(f.version) < highestApplied) {
      problems.push(`Migration ${f.filename} is pending but a later version (${highestApplied}) is already recorded. Out-of-order application is refused.`);
    }
  }
  return { pending, problems };
}

// ---------------------------------------------------------------------------
// Baseline description (database/baseline/BASELINE_INFO.json)
// ---------------------------------------------------------------------------

export interface BaselineInfo {
  source: string;
  includesMigrations: string[];
  evidence: string;
}

/** Validates the info file and returns the migration files the baseline claims to contain. */
export function planBaselineMarks(info: unknown, files: MigrationFile[]): MigrationFile[] {
  const i = info as Partial<BaselineInfo>;
  if (!i || typeof i.source !== 'string' || !i.source.trim()) throw new Error('BASELINE_INFO.json: "source" is required.');
  if (typeof i.evidence !== 'string' || !i.evidence.trim()) throw new Error('BASELINE_INFO.json: "evidence" is required.');
  if (!Array.isArray(i.includesMigrations)) throw new Error('BASELINE_INFO.json: "includesMigrations" must be an array.');
  const out: MigrationFile[] = [];
  for (const v of i.includesMigrations) {
    const f = files.find((x) => x.version === v);
    if (!f) throw new Error(`BASELINE_INFO.json: includes unknown migration ${v}.`);
    if (f.superseded) throw new Error(`BASELINE_INFO.json: migration ${v} is superseded and cannot be marked.`);
    if (out.includes(f)) throw new Error(`BASELINE_INFO.json: duplicate migration ${v}.`);
    out.push(f);
  }
  return out;
}
