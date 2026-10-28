import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertDisposableTestTarget, assertMigrationCanBeMarked, validateDisposableTestDbName, resolveTarget, isDraftMigration,
  checksumOf, loadMigrations, loadSuperseded, planBaselineMarks, planMigrations, type DbTarget, type MigrationFile,
} from './lib.js';

const target = (over: Partial<DbTarget> = {}): DbTarget => ({
  kind: 'test', host: '127.0.0.1', port: 3306, user: 'u', password: '', database: 'sauda_test_ci', ...over,
});
const OK_ENV = { SAUDA_ALLOW_DESTRUCTIVE_TESTS: 'yes', DB_NAME: 'sharktank_db' } as NodeJS.ProcessEnv;

test('test DB name rules', () => {
  assert.equal(validateDisposableTestDbName('sauda_test_ci'), null);
  for (const bad of ['sharktank_db', 'SHARKTANK_DB', 'sharktank_db_test_full_20261023', 'sauda_test', 'sauda_test_', 'prod', 'sauda_test_x; DROP', 'mysql', undefined]) {
    assert.notEqual(validateDisposableTestDbName(bad as string), null, String(bad));
  }
});

test('guard requires opt-in, test kind, local host, and a DB distinct from DB_NAME', () => {
  assert.doesNotThrow(() => assertDisposableTestTarget(target(), OK_ENV));
  assert.throws(() => assertDisposableTestTarget(target(), { DB_NAME: 'x' } as NodeJS.ProcessEnv), /SAUDA_ALLOW_DESTRUCTIVE_TESTS/);
  assert.throws(() => assertDisposableTestTarget(target({ kind: 'main' }), OK_ENV), /non-test/);
  assert.throws(() => assertDisposableTestTarget(target({ database: 'sharktank_db' }), OK_ENV), /protected/);
  assert.throws(() => assertDisposableTestTarget(target({ host: 'db.example.com' }), OK_ENV), /not local/);
  assert.doesNotThrow(() => assertDisposableTestTarget(target({ host: 'db.example.com' }), { ...OK_ENV, SAUDA_TEST_DB_ALLOW_REMOTE: 'yes' }));
  assert.throws(() => assertDisposableTestTarget(target(), { ...OK_ENV, DB_NAME: 'SAUDA_TEST_CI' }), /identical/);
});

test('resolveTarget reports missing names, not values', () => {
  assert.throws(() => resolveTarget('test', { TEST_DB_HOST: 'h' } as NodeJS.ProcessEnv), /TEST_DB_USER.*TEST_DB_NAME/s);
  const t = resolveTarget('test', { TEST_DB_HOST: 'h', TEST_DB_USER: 'u', TEST_DB_PASSWORD: '', TEST_DB_NAME: 'sauda_test_a' } as NodeJS.ProcessEnv);
  assert.equal(t.port, 3306);
});

test('draft detection by name or header', () => {
  assert.equal(isDraftMigration('002_x_DRAFT.sql', ''), true);
  assert.equal(isDraftMigration('001_x.sql', '-- header\n-- STATUS: DRAFT FOR REVIEW ONLY\n'), true);
  assert.equal(isDraftMigration('004_x.sql', '-- STATUS: REVIEWED\n'), false);
});

test('checksum is line-ending independent', () => {
  assert.equal(checksumOf('a\r\nb'), checksumOf('a\nb'));
});

test('loadMigrations orders numerically and rejects duplicates / bad names', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  fs.writeFileSync(path.join(dir, '010_b.sql'), 'SELECT 1;');
  fs.writeFileSync(path.join(dir, '002_a.sql'), 'SELECT 1;');
  assert.deepEqual(loadMigrations(dir).map((m) => m.version), ['002', '010']);
  fs.writeFileSync(path.join(dir, '002_dup.sql'), 'SELECT 1;');
  assert.throws(() => loadMigrations(dir), /Duplicate/);
  fs.rmSync(path.join(dir, '002_dup.sql'));
  fs.writeFileSync(path.join(dir, 'oops.sql'), 'SELECT 1;');
  assert.throws(() => loadMigrations(dir), /not recognised/);
});

const mf = (version: string, sql = 'x'): MigrationFile => ({
  version, name: 'n', filename: `${version}_n.sql`, fullPath: '', checksum: checksumOf(sql), isDraft: false, sql,
});

test('planMigrations: pending, APPLYING block, checksum drift, out-of-order', () => {
  const files = [mf('001'), mf('002'), mf('003')];
  assert.deepEqual(planMigrations(files, []).pending.map((f) => f.version), ['001', '002', '003']);
  const ok = planMigrations(files, [{ version: '001', checksum_sha256: files[0].checksum, status: 'APPLIED' }]);
  assert.deepEqual(ok.pending.map((f) => f.version), ['002', '003']);
  assert.equal(ok.problems.length, 0);
  assert.match(planMigrations(files, [{ version: '001', checksum_sha256: 'x', status: 'APPLYING' }]).problems.join(), /PARTIALLY/);
  assert.match(planMigrations(files, [{ version: '001', checksum_sha256: 'bad', status: 'APPLIED' }]).problems.join(), /checksum/);
  assert.match(planMigrations(files, [{ version: '003', checksum_sha256: files[2].checksum, status: 'APPLIED' }]).problems.join(), /Out-of-order/);
  assert.match(planMigrations(files, [{ version: '009', checksum_sha256: 'x', status: 'APPLIED' }]).problems.join(), /no matching file/);
});

test('superseded migrations cannot be explicitly marked as applied', () => {
  const current = { ...mf('002'), superseded: 'Replaced by a later migration.' };
  assert.throws(() => assertMigrationCanBeMarked(current), /superseded and cannot be marked applied/);
  assert.doesNotThrow(() => assertMigrationCanBeMarked(mf('004')));
});

test('superseded migrations are skipped by the planner and validated on load', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sup-'));
  fs.writeFileSync(path.join(dir, '001_a.sql'), 'SELECT 1;');
  fs.writeFileSync(path.join(dir, '002_b.sql'), 'SELECT 1;');
  fs.writeFileSync(path.join(dir, 'superseded.json'), JSON.stringify({ '002': 'replaced' }));
  const files = loadMigrations(dir);
  assert.equal(files[1].superseded, 'replaced');
  assert.deepEqual(planMigrations(files, []).pending.map((f) => f.version), ['001']);
  fs.writeFileSync(path.join(dir, 'superseded.json'), JSON.stringify({ '009': 'x' }));
  assert.throws(() => loadMigrations(dir), /no such migration/);
  fs.writeFileSync(path.join(dir, 'superseded.json'), JSON.stringify({ '002': '' }));
  assert.throws(() => loadSuperseded(dir), /non-empty reason/);
});

test('planBaselineMarks validates versions and required fields', () => {
  const files = [mf('001'), { ...mf('002'), superseded: 'x' }];
  const ok = { source: 's', evidence: 'e', includesMigrations: ['001'] };
  assert.deepEqual(planBaselineMarks(ok, files).map((f) => f.version), ['001']);
  assert.throws(() => planBaselineMarks({ ...ok, includesMigrations: ['009'] }, files), /unknown/);
  assert.throws(() => planBaselineMarks({ ...ok, includesMigrations: ['002'] }, files), /superseded/);
  assert.throws(() => planBaselineMarks({ ...ok, includesMigrations: ['001', '001'] }, files), /duplicate/);
  assert.throws(() => planBaselineMarks({ ...ok, evidence: '' }, files), /evidence/);
  assert.throws(() => planBaselineMarks({ source: 's', evidence: 'e' }, files), /array/);
});
