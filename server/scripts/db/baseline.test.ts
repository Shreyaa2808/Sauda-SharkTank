/**
 * Static checks only: reads files, never connects to a database.
 * Verifies the baseline against the schema export's conclusions, migrations 001-003 and the backend SQL.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMigrations, planBaselineMarks, planMigrations } from './lib.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const stripSqlComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '');

interface TableDef { name: string; body: string; columns: Map<string, string>; names: Set<string>; fks: string[] }

function parseTables(sql: string): Map<string, TableDef> {
  const out = new Map<string, TableDef>();
  for (const m of stripSqlComments(sql).matchAll(/CREATE TABLE\s+`?(\w+)`?\s*\(([\s\S]*?)\n\)\s*ENGINE/gi)) {
    const columns = new Map<string, string>();
    const names = new Set<string>();
    const fks: string[] = [];
    let depth = 0; // only lines that START at parenthesis depth 0 are definitions (multi-line CHECKs/ENUMs continue)
    for (const raw of m[2].split('\n')) {
      const line = raw.trim().replace(/,$/, '');
      const startsAtTop = depth === 0;
      depth += (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
      let k: RegExpExecArray | null;
      if ((k = /REFERENCES\s+`?(\w+)`?/i.exec(line))) fks.push(k[1]);
      if (!startsAtTop) continue;
      if ((k = /^(?:CONSTRAINT|UNIQUE KEY|KEY)\s+`?(\w+)`?/i.exec(line))) names.add(k[1]);
      if ((k = /^`?(\w+)`?\s+([a-z]+)/i.exec(line)) && !/^(PRIMARY|UNIQUE|KEY|CONSTRAINT|FOREIGN|CHECK|ON|REFERENCES|STORED|GENERATED)$/i.test(k[1])) {
        columns.set(k[1], k[2].toLowerCase());
      }
    }
    out.set(m[1], { name: m[1], body: m[2], columns, names, fks });
  }
  return out;
}

const baseline = parseTables(read('database/baseline/001_baseline_schema.sql'));

test('baseline: 41 InnoDB tables, schema only, never destructive', () => {
  assert.equal(baseline.size, 41);
  const exec = stripSqlComments(read('database/baseline/001_baseline_schema.sql'));
  const statements = exec.split(';').map((x) => x.trim()).filter(Boolean);
  assert.equal(statements.length, 41);
  for (const st of statements) assert.match(st, /^CREATE TABLE /i, `unexpected statement: ${st.slice(0, 40)}`);
  assert.doesNotMatch(exec, /AUTO_INCREMENT=\d+/i);
  assert.doesNotMatch(exec, /DEFINER|TRIGGER/i);
});

test('baseline: every foreign key references a table created earlier (or itself)', () => {
  const seen = new Set<string>();
  for (const t of baseline.values()) {
    for (const ref of t.fks) assert.ok(ref === t.name || seen.has(ref), `${t.name} references ${ref} before it exists`);
    seen.add(t.name);
  }
});

test('migration 001 is represented in the baseline (names and key types)', () => {
  const m001 = read('database/migrations/001_platform_auth_connections_messaging.sql');
  const created = parseTables(m001);
  assert.deepEqual([...created.keys()].sort(), ['connection_request', 'conversation', 'message']);
  for (const [name, def] of created) {
    const b = baseline.get(name);
    assert.ok(b, `${name} missing from baseline`);
    for (const [col, type] of def.columns) {
      assert.ok(b.columns.has(col), `${name}.${col} missing from baseline`);
      assert.equal(b.columns.get(col), type, `${name}.${col} type differs`);
    }
    for (const n of def.names) assert.ok(b.names.has(n), `${name}: constraint/key ${n} missing from baseline`);
  }
  // The ALTER TABLE app_user part of 001
  const au = baseline.get('app_user')!;
  assert.ok(au.columns.has('google_subject'));
  for (const n of ['uq_app_user_google_subject', 'chk_app_user_password_hash_nonblank', 'chk_app_user_google_subject_nonblank', 'chk_app_user_auth_identifier']) {
    assert.ok(au.names.has(n), `app_user ${n}`);
  }
  assert.match(au.body, /`password_hash` varchar\(255\) DEFAULT NULL/);
  assert.match(au.body, /`google_subject` varchar\(255\) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL/);
});

test('migration 002 is NOT represented (stays a pending draft)', () => {
  const pitch = baseline.get('pitch')!;
  assert.equal(pitch.columns.has('updated_at'), false);
  assert.equal(pitch.columns.has('review_note'), false);
  const files = loadMigrations(path.join(root, 'database/migrations'));
  const m002 = files.find((f) => f.version === '002')!;
  assert.equal(m002.isDraft, true);
  assert.match(m002.sql, /ADD COLUMN updated_at/);
});

test('migration 003 is superseded: real user_saved_pitch has the shape documented in the baseline', () => {
  const t = baseline.get('user_saved_pitch')!;
  assert.deepEqual([...t.columns.keys()], ['user_id', 'pitch_id', 'saved_at', 'private_notes']);
  assert.match(t.body, /PRIMARY KEY \(`user_id`,`pitch_id`\)/);
  assert.doesNotMatch(t.body, /ON DELETE CASCADE/i);
  const files = loadMigrations(path.join(root, 'database/migrations'));
  const m003 = files.find((f) => f.version === '003')!;
  assert.ok(m003.superseded);
  assert.equal(stripSqlComments(m003.sql).trim(), '', '003 must contain no executable SQL');
  const plan = planMigrations(files, []);
  assert.deepEqual(plan.pending.map((f) => f.version), ['001', '002']);
});

test('baseline info is valid and only claims 001', () => {
  const files = loadMigrations(path.join(root, 'database/migrations'));
  const marks = planBaselineMarks(JSON.parse(read('database/baseline/BASELINE_INFO.json')), files);
  assert.deepEqual(marks.map((f) => f.version), ['001']);
});

test('backend INSERT targets and columns exist in the baseline', () => {
  const srcDir = path.join(root, 'server/src');
  let checked = 0;
  for (const f of fs.readdirSync(srcDir).filter((x) => x.endsWith('.ts') && !x.startsWith('test_'))) {
    const src = fs.readFileSync(path.join(srcDir, f), 'utf8');
    for (const m of src.matchAll(/INSERT\s+(?:IGNORE\s+)?INTO\s+(\w+)\s*\(([^)]*)\)/gi)) {
      const t = baseline.get(m[1]);
      assert.ok(t, `${f}: INSERT into unknown table ${m[1]}`);
      for (const col of m[2].split(',').map((c) => c.trim()).filter(Boolean)) {
        assert.ok(t.columns.has(col), `${f}: ${m[1]}.${col} not in baseline`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 20, `expected to check many columns, got ${checked}`);
});

test('backend SELECT/UPDATE columns exist in the baseline (curated from a manual review of the queries)', () => {
  const used: Record<string, string[]> = {
    app_user: ['user_id', 'full_name', 'email', 'google_subject', 'password_hash', 'phone_number', 'account_status', 'created_at'],
    app_role: ['role_id', 'role_name'],
    user_role: ['user_id', 'role_id'],
    founder: ['user_id', 'first_name', 'last_name', 'email'],
    investor: ['user_id', 'first_name', 'last_name', 'display_name', 'investment_firm_name'],
    company: ['company_id', 'brand_name', 'legal_business_name', 'industry_id', 'stage_id', 'business_model', 'website_url', 'founded_year', 'headquarters_city', 'headquarters_state', 'headquarters_country'],
    pitch: ['pitch_id', 'company_id', 'pitch_type', 'submitted_by_user_id', 'original_ask_amount', 'original_ask_equity_pct', 'pitch_hook', 'pitch_status', 'submitted_at'],
    industry: ['industry_id', 'industry_name', 'description'],
    startup_stage: ['stage_id', 'stage_name'],
    user_saved_pitch: ['user_id', 'pitch_id', 'saved_at'],
    connection_request: ['request_id', 'pitch_id', 'investor_user_id', 'founder_user_id', 'request_status', 'initial_message', 'status_reason', 'created_at', 'updated_at', 'responded_at', 'withdrawn_at', 'ended_at'],
    conversation: ['conversation_id', 'request_id', 'conversation_status', 'created_at', 'closed_at'],
    message: ['message_id', 'conversation_id', 'sender_user_id', 'message_body', 'created_at'],
  };
  for (const [t, cols] of Object.entries(used)) {
    const def = baseline.get(t);
    assert.ok(def, `table ${t}`);
    for (const c of cols) assert.ok(def.columns.has(c), `${t}.${c}`);
  }
});

test('backend key assumptions hold: unique keys behind INSERT IGNORE / ON DUPLICATE KEY', () => {
  assert.match(baseline.get('user_role')!.body, /PRIMARY KEY \(`user_id`,`role_id`\)/);
  assert.match(baseline.get('founder')!.body, /UNIQUE KEY `user_id` \(`user_id`\)/);
  assert.match(baseline.get('investor')!.body, /UNIQUE KEY `user_id` \(`user_id`\)/);
  assert.match(baseline.get('app_role')!.body, /UNIQUE KEY `role_name`/);
  assert.match(baseline.get('app_user')!.body, /UNIQUE KEY `email`/);
});

test('pitch_status enum equals the backend PitchStatus type', () => {
  const ts = read('server/src/founder.ts');
  const tsVals = [...(/export type PitchStatus =([^;]+);/.exec(ts)![1].matchAll(/'(\w+)'/g))].map((m) => m[1]).sort();
  const dbVals = [...(/`pitch_status` enum\(([^)]*)\)/.exec(baseline.get('pitch')!.body)![1].matchAll(/'(\w+)'/g))].map((m) => m[1]).sort();
  assert.deepEqual(tsVals, dbVals);
});

test('reference seed: role names only, no ids, no other tables, no users', () => {
  const seed = stripSqlComments(read('database/baseline/002_reference_seed.sql'));
  assert.match(seed, /^\s*INSERT IGNORE INTO app_role \(role_name\) VALUES\s*\('VIEWER'\),\s*\('FOUNDER'\),\s*\('INVESTOR'\),\s*\('ADMIN'\);\s*$/);
});
