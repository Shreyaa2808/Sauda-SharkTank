import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbPool } from './db.js';
import {
  AdminReviewError,
  decideAdminReview,
  getAdminReviewDetail,
  getAdminReviewQueue,
  getFounderPitchReviewHistory,
  parseReviewDecisionInput,
} from './adminReview.js';
import { assertIntegrationTargetSafe, verifyConnectedDatabase } from './testSafetyGuards.js';

let safeTarget: { dbName: string };
try {
  safeTarget = assertIntegrationTargetSafe({
    optInEnvVar: 'SAUDA_RUN_ADMIN_REVIEW_INTEGRATION',
    requireApiUrl: false,
  });
} catch {
  process.exit(1);
}

test('admin review: queue, history, publish/reject, rollback, and concurrent decisions use MySQL transactions', async (t) => {
  await verifyConnectedDatabase(dbPool, safeTarget.dbName);
  const runId = randomUUID().replace(/-/g, '').slice(0, 20);
  const createdUserIds: number[] = [];
  const createdCompanyIds: number[] = [];
  const createdPitchIds: number[] = [];
  let createdIndustryId: number | undefined;
  let shouldDeleteIndustry = false;

  async function cleanup() {
    if (createdPitchIds.length) {
      const marks = createdPitchIds.map(() => '?').join(',');
      await dbPool.execute(`DELETE FROM pitch_review_event WHERE pitch_id IN (${marks})`, createdPitchIds);
      await dbPool.execute(`DELETE FROM pitch WHERE pitch_id IN (${marks})`, createdPitchIds);
    }
    if (createdCompanyIds.length) {
      const marks = createdCompanyIds.map(() => '?').join(',');
      await dbPool.execute(`DELETE FROM company WHERE company_id IN (${marks})`, createdCompanyIds);
    }
    if (createdUserIds.length) {
      const marks = createdUserIds.map(() => '?').join(',');
      await dbPool.execute(`DELETE FROM app_user WHERE user_id IN (${marks})`, createdUserIds);
    }
    if (shouldDeleteIndustry && createdIndustryId) {
      await dbPool.execute('DELETE FROM industry WHERE industry_id = ?', [createdIndustryId]);
    }
  }

  async function createUser(label: string): Promise<number> {
    const email = `sauda-admin-review-${runId}-${label}@example.invalid`;
    const googleSubject = `sauda-admin-review-${runId}-${label}`;
    const [result] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO app_user (full_name, email, google_subject, account_status)
       VALUES (?, ?, ?, 'ACTIVE')`,
      [`Admin Review ${label}`, email, googleSubject],
    );
    createdUserIds.push(result.insertId);
    return result.insertId;
  }

  async function createSubmittedPitch(founderUserId: number, label: string, industryId: number): Promise<number> {
    const [companyResult] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO company (brand_name, legal_business_name, industry_id, headquarters_country)
       VALUES (?, ?, ?, 'India')`,
      [`__SAUDA_ADMIN_REVIEW_${runId}_${label}__`, `Admin Review Test ${runId} ${label}`, industryId],
    );
    createdCompanyIds.push(companyResult.insertId);
    const [pitchResult] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO pitch
         (company_id, pitch_type, episode_id, submitted_by_user_id, original_ask_amount,
          original_ask_equity_pct, pitch_hook, pitch_status, submitted_at)
       VALUES (?, 'PLATFORM', NULL, ?, 100000, 10, ?, 'SUBMITTED', CURRENT_TIMESTAMP)`,
      [companyResult.insertId, founderUserId, `Integration-test pitch ${label}`],
    );
    createdPitchIds.push(pitchResult.insertId);
    return pitchResult.insertId;
  }

  try {
    const [eventTables] = await dbPool.execute<RowDataPacket[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'pitch_review_event'`,
    );
    if (!eventTables.length) {
      t.skip(
        'PREREQUISITE BLOCKED: pitch_review_event table is absent. Migration 004 is kept as DRAFT and unapplied in this phase.',
      );
      return;
    }
    const [trackingTables] = await dbPool.execute<RowDataPacket[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'schema_migrations'`,
    );
    if (!trackingTables.length) {
      t.skip('PREREQUISITE BLOCKED: schema_migrations is absent; run Phase 1 baseline setup first.');
      return;
    }
    const [migrationRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT status FROM schema_migrations WHERE version = '004'`,
    );
    if (migrationRows[0]?.status !== 'APPLIED') {
      t.skip(
        'PREREQUISITE BLOCKED: Migration 004 is DRAFT and not recorded as APPLIED. Keep 004 as draft unless separately authorized.',
      );
      return;
    }

    const [industries] = await dbPool.execute<RowDataPacket[]>(
      'SELECT industry_id AS industryId FROM industry ORDER BY industry_id LIMIT 1',
    );
    let industryId: number;
    if (industries.length) {
      industryId = Number(industries[0].industryId);
    } else {
      const [result] = await dbPool.execute<ResultSetHeader>(
        'INSERT INTO industry (industry_name, description) VALUES (?, ?)',
        [`__SAUDA_TEST_ADMIN_REVIEW_${runId}__`, 'Disposable integration-test-only industry fixture.'],
      );
      industryId = Number(result.insertId);
      createdIndustryId = industryId;
      shouldDeleteIndustry = true;
    }

    const founderId = await createUser('founder');
    const reviewerId = await createUser('reviewer');

    await t.test('submitted platform pitch is visible in queue and detail', async () => {
      const pitchId = await createSubmittedPitch(founderId, 'queue', industryId);
      const queue = await getAdminReviewQueue(dbPool);
      assert.ok(queue.some((pitch) => Number(pitch.pitchId) === pitchId));
      const detail = await getAdminReviewDetail(dbPool, pitchId);
      assert.equal(Number(detail.pitch.pitchId), pitchId);
      assert.equal(detail.pitch.pitchStatus, 'SUBMITTED');
      assert.equal(detail.history.length, 0);
    });

    await t.test('publish decision persists status and review history', async () => {
      const pitchId = createdPitchIds[0];
      const input = parseReviewDecisionInput({ decision: 'PUBLISH', note: 'Reviewed integration fixture.' });
      if (!input.ok) throw new Error(input.message);
      const decision = await decideAdminReview(dbPool, pitchId, reviewerId, input.value);
      assert.equal(decision.pitchStatus, 'PUBLISHED');
      const detail = await getAdminReviewDetail(dbPool, pitchId);
      assert.equal(detail.pitch.pitchStatus, 'PUBLISHED');
      assert.equal(detail.history.length, 1);
      assert.equal(detail.history[0].decision, 'PUBLISH');
      assert.deepEqual(
        (await getFounderPitchReviewHistory(dbPool, founderId, pitchId)).map((item) => item.decision),
        ['PUBLISH'],
      );
      await assert.rejects(
        () => getFounderPitchReviewHistory(dbPool, reviewerId, pitchId),
        (error: unknown) => error instanceof AdminReviewError && error.status === 404,
      );
    });

    await t.test('reject decision persists required feedback and history', async () => {
      const pitchId = await createSubmittedPitch(founderId, 'reject', industryId);
      const input = parseReviewDecisionInput({ decision: 'REJECT', note: 'Please provide clearer financial evidence.' });
      if (!input.ok) throw new Error(input.message);
      const decision = await decideAdminReview(dbPool, pitchId, reviewerId, input.value);
      assert.equal(decision.pitchStatus, 'REJECTED');
      const detail = await getAdminReviewDetail(dbPool, pitchId);
      assert.equal(detail.pitch.pitchStatus, 'REJECTED');
      assert.equal(detail.history.length, 1);
      assert.equal(detail.history[0].decision, 'REJECT');
      assert.equal(detail.history[0].reviewNote, 'Please provide clearer financial evidence.');
    });

    await t.test('failed history insert rolls back the pitch status change', async () => {
      const pitchId = await createSubmittedPitch(founderId, 'rollback', industryId);
      const input = parseReviewDecisionInput({ decision: 'REJECT', note: 'Valid test rejection reason.' });
      if (!input.ok) throw new Error(input.message);
      // The reviewer FK fails after the status UPDATE, proving the service rolls both
      // operations back together rather than leaving an unrecorded moderation decision.
      await assert.rejects(() => decideAdminReview(dbPool, pitchId, Number.MAX_SAFE_INTEGER, input.value));
      const detail = await getAdminReviewDetail(dbPool, pitchId);
      assert.equal(detail.pitch.pitchStatus, 'SUBMITTED');
      assert.equal(detail.history.length, 0);
    });

    await t.test('concurrent publish/reject decisions allow exactly one winner', async () => {
      const pitchId = await createSubmittedPitch(founderId, 'race', industryId);
      const publish = parseReviewDecisionInput({ decision: 'PUBLISH' });
      const reject = parseReviewDecisionInput({ decision: 'REJECT', note: 'Rejected integration test pitch.' });
      if (!publish.ok || !reject.ok) throw new Error('Test decision fixture was invalid.');
      const results = await Promise.allSettled([
        decideAdminReview(dbPool, pitchId, reviewerId, publish.value),
        decideAdminReview(dbPool, pitchId, reviewerId, reject.value),
      ]);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      assert.equal(failures.length, 1);
      assert.ok(failures[0].reason instanceof AdminReviewError);
      assert.equal((failures[0].reason as AdminReviewError).status, 409);
      const detail = await getAdminReviewDetail(dbPool, pitchId);
      assert.ok(['PUBLISHED', 'REJECTED'].includes(detail.pitch.pitchStatus));
      assert.equal(detail.history.length, 1);
    });
  } finally {
    try {
      await cleanup();
    } finally {
      await dbPool.end();
    }
  }
});
