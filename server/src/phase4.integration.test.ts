import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbPool } from './db.js';
import { signSession, authenticateOrProvisionGoogleUser } from './auth.js';
import { getAdminReviewQueue } from './adminReview.js';
import { assertIntegrationTargetSafe, verifyConnectedDatabase } from './testSafetyGuards.js';

// ============================================================================
// SAFETY CONTROLS & ENVIRONMENT GUARDS
// ============================================================================

let safeTarget: { dbName: string; apiUrl?: string };
try {
  safeTarget = assertIntegrationTargetSafe({
    optInEnvVar: 'SAUDA_RUN_PHASE4_INTEGRATION_TESTS',
    requireApiUrl: true,
  });
} catch {
  process.exit(1);
}
const API_BASE = safeTarget.apiUrl!;

function sessionCookie(userId: number, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const token = signSession({ userId, email, iat: now, exp: now + 3600 });
  return `sauda_session=${token}; Path=/; HttpOnly; SameSite=Lax`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('Sauda Phase 4: Founder/Investor Workflow Correctness Integration Suite', async (t) => {
  await verifyConnectedDatabase(dbPool, safeTarget.dbName);
  const runId = randomUUID().replace(/-/g, '').slice(0, 16);
  const tag = `__P4_${runId}__`;

  const createdUserIds: number[] = [];
  const createdCompanyIds: number[] = [];
  const createdPitchIds: number[] = [];
  const createdRequestIds: number[] = [];
  let testIndustryId: number | null = null;
  let testStageId: number | null = null;
  let createdTestIndustry = false;
  let createdTestStage = false;

  async function cleanup() {
    try {
      if (createdRequestIds.length) {
        const marks = createdRequestIds.map(() => '?').join(',');
        await dbPool.execute(`DELETE FROM message WHERE conversation_id IN (SELECT conversation_id FROM conversation WHERE request_id IN (${marks}))`, createdRequestIds);
        await dbPool.execute(`DELETE FROM conversation WHERE request_id IN (${marks})`, createdRequestIds);
        await dbPool.execute(`DELETE FROM connection_request WHERE request_id IN (${marks})`, createdRequestIds);
      }
      if (createdPitchIds.length) {
        const marks = createdPitchIds.map(() => '?').join(',');
        await dbPool.execute(`DELETE FROM message WHERE conversation_id IN (SELECT conversation_id FROM conversation WHERE request_id IN (SELECT request_id FROM connection_request WHERE pitch_id IN (${marks})))`, createdPitchIds).catch(() => undefined);
        await dbPool.execute(`DELETE FROM conversation WHERE request_id IN (SELECT request_id FROM connection_request WHERE pitch_id IN (${marks}))`, createdPitchIds).catch(() => undefined);
        await dbPool.execute(`DELETE FROM connection_request WHERE pitch_id IN (${marks})`, createdPitchIds);
      }
      if (createdUserIds.length && createdPitchIds.length) {
        const userMarks = createdUserIds.map(() => '?').join(',');
        const pitchMarks = createdPitchIds.map(() => '?').join(',');
        await dbPool.execute(`DELETE FROM user_saved_pitch WHERE user_id IN (${userMarks}) OR pitch_id IN (${pitchMarks})`, [...createdUserIds, ...createdPitchIds]);
      }
      if (createdPitchIds.length) {
        const marks = createdPitchIds.map(() => '?').join(',');
        await dbPool.execute(`DELETE FROM pitch_review_event WHERE pitch_id IN (${marks})`, createdPitchIds).catch(() => undefined);
        await dbPool.execute(`DELETE FROM pitch WHERE pitch_id IN (${marks})`, createdPitchIds);
      }
      if (createdCompanyIds.length) {
        const marks = createdCompanyIds.map(() => '?').join(',');
        await dbPool.execute(`DELETE FROM company WHERE company_id IN (${marks})`, createdCompanyIds);
      }
      if (createdUserIds.length) {
        const marks = createdUserIds.map(() => '?').join(',');
        await dbPool.execute(`DELETE FROM investor_industry_preference WHERE investor_id IN (SELECT investor_id FROM investor WHERE user_id IN (${marks}))`, createdUserIds);
        await dbPool.execute(`DELETE FROM investor_stage_preference WHERE investor_id IN (SELECT investor_id FROM investor WHERE user_id IN (${marks}))`, createdUserIds);
        await dbPool.execute(`DELETE FROM investor_profile WHERE investor_id IN (SELECT investor_id FROM investor WHERE user_id IN (${marks}))`, createdUserIds);
        await dbPool.execute(`DELETE FROM investor WHERE user_id IN (${marks})`, createdUserIds);
        await dbPool.execute(`DELETE FROM founder WHERE user_id IN (${marks})`, createdUserIds);
        await dbPool.execute(`DELETE FROM user_role WHERE user_id IN (${marks})`, createdUserIds);
        await dbPool.execute(`DELETE FROM app_user WHERE user_id IN (${marks})`, createdUserIds);
      }
      if (createdTestIndustry && testIndustryId) {
        await dbPool.execute('DELETE FROM industry WHERE industry_id = ?', [testIndustryId]);
      }
      if (createdTestStage && testStageId) {
        await dbPool.execute('DELETE FROM startup_stage WHERE stage_id = ?', [testStageId]);
      }
    } catch (err) {
      console.error('Cleanup encountered error:', err);
    }
  }

  // Ensure reference industry and stage exist
  const [indRows] = await dbPool.execute<RowDataPacket[]>('SELECT industry_id FROM industry LIMIT 1');
  if (indRows.length > 0) {
    testIndustryId = Number(indRows[0].industry_id);
  } else {
    const [indRes] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO industry (industry_name, description) VALUES (?, ?)`,
      [`Industry_${tag}`, 'Test industry for Phase 4'],
    );
    testIndustryId = indRes.insertId;
    createdTestIndustry = true;
  }

  const [stgRows] = await dbPool.execute<RowDataPacket[]>('SELECT stage_id FROM startup_stage LIMIT 1');
  if (stgRows.length > 0) {
    testStageId = Number(stgRows[0].stage_id);
  } else {
    const [stgRes] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO startup_stage (stage_name) VALUES (?)`,
      [`Stage_${tag}`],
    );
    testStageId = stgRes.insertId;
    createdTestStage = true;
  }

  // Provision test users
  async function createTestIdentity(label: string, roles: string[]): Promise<{ userId: number; email: string; cookie: string }> {
    const email = `test_${label}_${runId}@sauda.test`;
    const fullName = `Test ${label} ${runId}`;
    const googleSubject = `sub_p4_${label}_${runId}`;
    const [res] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO app_user (full_name, email, google_subject, account_status) VALUES (?, ?, ?, 'ACTIVE')`,
      [fullName, email, googleSubject],
    );
    const userId = res.insertId;
    createdUserIds.push(userId);

    for (const r of roles) {
      const [roleRow] = await dbPool.execute<RowDataPacket[]>('SELECT role_id FROM app_role WHERE role_name = ?', [r]);
      if (roleRow.length > 0) {
        await dbPool.execute('INSERT IGNORE INTO user_role (user_id, role_id) VALUES (?, ?)', [userId, roleRow[0].role_id]);
      }
    }

    if (roles.includes('FOUNDER')) {
      await dbPool.execute(
        `INSERT INTO founder (user_id, first_name, last_name, email, city, country)
         VALUES (?, ?, 'Founder', ?, 'Mumbai', 'India')`,
        [userId, label, email],
      );
    }

    if (roles.includes('INVESTOR')) {
      const [invRes] = await dbPool.execute<ResultSetHeader>(
        `INSERT INTO investor (user_id, first_name, last_name, display_name, investment_firm_name, city, country)
         VALUES (?, ?, 'Investor', ?, 'Ventures LLC', 'Bengaluru', 'India')`,
        [userId, label, `${label} Investor`],
      );
      await dbPool.execute(
        `INSERT INTO investor_profile (investor_id, min_investment_amount, max_investment_amount, is_accepting_pitches)
         VALUES (?, 10000, 100000, 1)`,
        [invRes.insertId],
      );
    }

    const cookie = sessionCookie(userId, email);
    return { userId, email, cookie };
  }

  const founder = await createTestIdentity('founder', ['VIEWER', 'FOUNDER']);
  const investor1 = await createTestIdentity('investor1', ['VIEWER', 'INVESTOR']);
  const investor2 = await createTestIdentity('investor2', ['VIEWER', 'INVESTOR']);
  const viewer = await createTestIdentity('viewer', ['VIEWER']);

  async function createPlatformPitch(founderUserId: number, pitchStatus: 'DRAFT' | 'SUBMITTED' | 'PUBLISHED'): Promise<{ pitchId: number; companyId: number }> {
    const [cRes] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO company (brand_name, legal_business_name, industry_id, stage_id, headquarters_country)
       VALUES (?, ?, ?, ?, 'India')`,
      [`Company_${tag}_${createdCompanyIds.length + 1}`, `Legal ${tag}`, testIndustryId, testStageId],
    );
    const companyId = cRes.insertId;
    createdCompanyIds.push(companyId);

    const [pRes] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO pitch (
         company_id, pitch_type, episode_id, submitted_by_user_id,
         original_ask_amount, original_ask_equity_pct, pitch_hook,
         pitch_status, submitted_at
       ) VALUES (?, 'PLATFORM', NULL, ?, 500000, 10, 'Revolutionary product', ?, CURRENT_TIMESTAMP)`,
      [companyId, founderUserId, pitchStatus],
    );
    const pitchId = pRes.insertId;
    createdPitchIds.push(pitchId);
    return { pitchId, companyId };
  }

  try {
    // ========================================================================
    // A. Investor-initiated withdrawal of a pending request
    // ========================================================================
    await t.test('Section A: Investor withdrawal of pending request and race against acceptance', async () => {
      const { pitchId } = await createPlatformPitch(founder.userId, 'PUBLISHED');

      // 1. Investor 1 creates a connection request via POST /api/connections/request
      const createRes = await fetch(`${API_BASE}/connections/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: investor1.cookie },
        body: JSON.stringify({ pitchId, initialMessage: 'Interested in partnering.' }),
      });
      assert.equal(createRes.status, 201, 'Connection request creation returned 201');
      const createJson = await createRes.json();
      const requestId = Number(createJson.requestId);
      createdRequestIds.push(requestId);

      // 2. Unauthorized withdrawal: Investor 2 attempts to withdraw Investor 1's request -> 403
      const unauthWithdrawRes = await fetch(`${API_BASE}/connections/${requestId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: investor2.cookie },
        body: JSON.stringify({ reason: 'Malicious withdraw attempt' }),
      });
      assert.equal(unauthWithdrawRes.status, 403, 'Other user receives 403 UNAUTHORIZED_REQUESTER');
      const unauthJson = await unauthWithdrawRes.json();
      assert.equal(unauthJson.error, 'UNAUTHORIZED_REQUESTER');

      // 3. Normal withdrawal by requester -> 200 with reason and withdrawnAt
      const withdrawRes = await fetch(`${API_BASE}/connections/${requestId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: investor1.cookie },
        body: JSON.stringify({ reason: 'Reallocating fund capital' }),
      });
      assert.equal(withdrawRes.status, 200, 'Requester withdraw returned 200');
      const withdrawJson = await withdrawRes.json();
      assert.equal(withdrawJson.request.requestStatus, 'WITHDRAWN');
      assert.equal(withdrawJson.request.statusReason, 'Reallocating fund capital');
      assert.ok(withdrawJson.request.withdrawnAt !== null, 'withdrawnAt timestamp is present');

      // Verify DB row
      const [dbReq] = await dbPool.execute<RowDataPacket[]>(
        'SELECT request_status, withdrawn_at, status_reason FROM connection_request WHERE request_id = ?',
        [requestId],
      );
      assert.equal(dbReq[0].request_status, 'WITHDRAWN');
      assert.ok(dbReq[0].withdrawn_at !== null);
      assert.equal(dbReq[0].status_reason, 'Reallocating fund capital');

      // 4. Repeated withdrawal attempt -> 409 INVALID_STATE
      const repeatWithdrawRes = await fetch(`${API_BASE}/connections/${requestId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: investor1.cookie },
      });
      assert.equal(repeatWithdrawRes.status, 409, 'Repeat withdrawal returns 409 INVALID_STATE');

      // 5. Simultaneous race: Investor withdraw vs Founder accept
      const { pitchId: racePitchId } = await createPlatformPitch(founder.userId, 'PUBLISHED');
      const raceReqRes = await fetch(`${API_BASE}/connections/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: investor1.cookie },
        body: JSON.stringify({ pitchId: racePitchId, initialMessage: 'Let us race' }),
      });
      assert.equal(raceReqRes.status, 201);
      const raceReqJson = await raceReqRes.json();
      const raceRequestId = Number(raceReqJson.requestId);
      createdRequestIds.push(raceRequestId);

      const withdrawOp = fetch(`${API_BASE}/connections/${raceRequestId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: investor1.cookie },
        body: JSON.stringify({ reason: 'Racing withdraw' }),
      });
      const acceptOp = fetch(`${API_BASE}/connections/${raceRequestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: founder.cookie },
        body: JSON.stringify({ action: 'ACCEPT' }),
      });

      const [resWithdraw, resAccept] = await Promise.all([withdrawOp, acceptOp]);
      const statuses = [resWithdraw.status, resAccept.status];

      // Exactly one succeeds (200), and the other fails with a conflict/invalid state response (400 or 409)
      const successCount = statuses.filter((s) => s === 200).length;
      assert.equal(successCount, 1, 'Exactly one concurrent transition succeeds');

      // Verify the database reflects a valid final state
      const [finalReq] = await dbPool.execute<RowDataPacket[]>(
        'SELECT request_status, withdrawn_at, responded_at FROM connection_request WHERE request_id = ?',
        [raceRequestId],
      );
      assert.ok(
        ['WITHDRAWN', 'ACCEPTED'].includes(finalReq[0].request_status),
        `Final request status is valid: ${finalReq[0].request_status}`,
      );
    });

    // ========================================================================
    // B. Prevent request creation from racing with pitch archiving
    // ========================================================================
    await t.test('Section B: Concurrent request creation vs pitch archiving', async () => {
      const { pitchId: archivePitchId } = await createPlatformPitch(founder.userId, 'PUBLISHED');

      // Launch request creation and pitch archive simultaneously
      const reqPromise = fetch(`${API_BASE}/connections/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: investor2.cookie },
        body: JSON.stringify({ pitchId: archivePitchId, initialMessage: 'Racing against archive' }),
      });

      const archivePromise = fetch(`${API_BASE}/founder/pitches/${archivePitchId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: founder.cookie },
      });

      const [reqResult, archiveResult] = await Promise.all([reqPromise, archivePromise]);

      assert.equal(archiveResult.status, 200, 'Founder archive pitch succeeded');

      // Verify final pitch status in MySQL database is ARCHIVED
      const [pRows] = await dbPool.execute<RowDataPacket[]>(
        'SELECT pitch_status FROM pitch WHERE pitch_id = ?',
        [archivePitchId],
      );
      assert.equal(pRows[0].pitch_status, 'ARCHIVED');

      // Verify any request created during the race was either rejected (409) or ended up WITHDRAWN by archive
      const [reqRows] = await dbPool.execute<RowDataPacket[]>(
        'SELECT request_id, request_status FROM connection_request WHERE pitch_id = ?',
        [archivePitchId],
      );
      for (const r of reqRows) {
        createdRequestIds.push(Number(r.request_id));
        assert.equal(
          r.request_status,
          'WITHDRAWN',
          'Any request created on an archived pitch must be WITHDRAWN',
        );
      }

      // Subsequent connection request to the archived pitch must fail with 409
      const postArchiveReq = await fetch(`${API_BASE}/connections/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: investor1.cookie },
        body: JSON.stringify({ pitchId: archivePitchId, initialMessage: 'Late request' }),
      });
      assert.equal(postArchiveReq.status, 409, 'Connection request on archived pitch returns 409');
    });

    // ========================================================================
    // C. Make watchlist toggling transactional and visibility-aware
    // ========================================================================
    await t.test('Section C: Transactional, visibility-aware watchlist toggling', async () => {
      const { pitchId: pubPitchId } = await createPlatformPitch(founder.userId, 'PUBLISHED');
      const { pitchId: draftPitchId } = await createPlatformPitch(founder.userId, 'DRAFT');

      // 1. Cannot add draft pitch to watchlist -> 409 PITCH_NOT_VISIBLE
      const draftToggle = await fetch(`${API_BASE}/investor/watchlist/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: investor1.cookie },
        body: JSON.stringify({ pitchId: draftPitchId }),
      });
      assert.equal(draftToggle.status, 409, 'Adding draft pitch returns 409');
      const draftJson = await draftToggle.json();
      assert.equal(draftJson.error, 'PITCH_NOT_VISIBLE');

      // 2. Add published pitch -> 200 saved: true
      const addToggle = await fetch(`${API_BASE}/investor/watchlist/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: investor1.cookie },
        body: JSON.stringify({ pitchId: pubPitchId }),
      });
      assert.equal(addToggle.status, 200, 'Saving published pitch returns 200');
      const addJson = await addToggle.json();
      assert.equal(addJson.saved, true);

      // Verify row in database
      const [savedRow1] = await dbPool.execute<RowDataPacket[]>(
        'SELECT user_id, pitch_id FROM user_saved_pitch WHERE user_id = ? AND pitch_id = ?',
        [investor1.userId, pubPitchId],
      );
      assert.equal(savedRow1.length, 1, 'Saved row exists in database');

      // 3. Remove from watchlist -> 200 saved: false
      const removeToggle = await fetch(`${API_BASE}/investor/watchlist/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: investor1.cookie },
        body: JSON.stringify({ pitchId: pubPitchId }),
      });
      assert.equal(removeToggle.status, 200, 'Removing from watchlist returns 200');
      const removeJson = await removeToggle.json();
      assert.equal(removeJson.saved, false);

      const [savedRow2] = await dbPool.execute<RowDataPacket[]>(
        'SELECT user_id, pitch_id FROM user_saved_pitch WHERE user_id = ? AND pitch_id = ?',
        [investor1.userId, pubPitchId],
      );
      assert.equal(savedRow2.length, 0, 'Saved row removed from database');

      // 4. Concurrent toggles for the same user and pitch serialize without server error
      const toggleAttempt = () =>
        fetch(`${API_BASE}/investor/watchlist/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: investor1.cookie },
          body: JSON.stringify({ pitchId: pubPitchId }),
        });

      const [res1, res2] = await Promise.all([toggleAttempt(), toggleAttempt()]);
      assert.ok([200, 409].includes(res1.status));
      assert.ok([200, 409].includes(res2.status));
      assert.notEqual(res1.status, 500, 'No 500 on concurrent toggle');
      assert.notEqual(res2.status, 500, 'No 500 on concurrent toggle');
    });

    // ========================================================================
    // D. Correct submission timestamps and review ordering
    // ========================================================================
    await t.test('Section D: Submission timestamps and review queue ordering in MySQL', async () => {
      // 1. Create a pitch as DRAFT with full valid fields
      const createPitchRes = await fetch(`${API_BASE}/founder/pitches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: founder.cookie },
        body: JSON.stringify({
          brandName: `DraftBrand_${tag}`,
          industryId: testIndustryId,
          stageId: testStageId,
          pitchHook: 'Draft hook for Phase 4 verification',
          originalAskAmount: 200000,
          originalAskEquityPct: 8,
          pitchStatus: 'DRAFT',
        }),
      });
      assert.equal(createPitchRes.status, 201, 'Pitch created as DRAFT');
      const createPitchJson = await createPitchRes.json();
      const pitchId = Number(createPitchJson.pitchId);
      createdPitchIds.push(pitchId);
      createdCompanyIds.push(Number(createPitchJson.pitch.companyId));

      const [tDraft] = await dbPool.execute<RowDataPacket[]>(
        'SELECT submitted_at FROM pitch WHERE pitch_id = ?',
        [pitchId],
      );
      const initialTimestamp = new Date(tDraft[0].submitted_at).getTime();

      // Wait 1.1 seconds and perform an ordinary edit of the draft
      await delay(1100);
      const editDraftRes = await fetch(`${API_BASE}/founder/pitches/${pitchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: founder.cookie },
        body: JSON.stringify({ pitchHook: 'Updated draft hook without submitting', pitchStatus: 'DRAFT' }),
      });
      assert.equal(editDraftRes.status, 200, 'Draft edited');

      const [tEdit] = await dbPool.execute<RowDataPacket[]>(
        'SELECT submitted_at FROM pitch WHERE pitch_id = ?',
        [pitchId],
      );
      const postEditTimestamp = new Date(tEdit[0].submitted_at).getTime();
      assert.equal(postEditTimestamp, initialTimestamp, 'submitted_at does NOT change on ordinary draft edits');

      // Wait 1.1 seconds and submit the draft -> submitted_at MUST update
      await delay(1100);
      const submitRes = await fetch(`${API_BASE}/founder/pitches/${pitchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: founder.cookie },
        body: JSON.stringify({
          pitchStatus: 'SUBMITTED',
          stageId: testStageId,
          pitchHook: 'Draft hook for Phase 4 verification',
          originalAskAmount: 200000,
          originalAskEquityPct: 8,
        }),
      });
      if (submitRes.status !== 200) {
        console.error('Submit draft failed:', await submitRes.json());
      }
      assert.equal(submitRes.status, 200, 'Draft submitted');

      const [tSubmit] = await dbPool.execute<RowDataPacket[]>(
        'SELECT submitted_at, pitch_status FROM pitch WHERE pitch_id = ?',
        [pitchId],
      );
      assert.equal(tSubmit[0].pitch_status, 'SUBMITTED');
      const submittedTimestamp = new Date(tSubmit[0].submitted_at).getTime();
      assert.ok(submittedTimestamp > initialTimestamp, 'submitted_at is updated when transitioning to SUBMITTED');

      // Review queue ordering deterministic test
      const queue = await getAdminReviewQueue(dbPool);
      for (let i = 0; i < queue.length - 1; i++) {
        const a = queue[i];
        const b = queue[i + 1];
        const timeA = new Date(a.submittedAt).getTime();
        const timeB = new Date(b.submittedAt).getTime();
        assert.ok(timeA <= timeB, 'Queue is sorted by submitted_at ASC');
        if (timeA === timeB) {
          assert.ok(Number(a.pitchId) < Number(b.pitchId), 'Queue uses pitch_id ASC as tie-breaker');
        }
      }
    });

    // ========================================================================
    // E. Complete founder and investor profile editing
    // ========================================================================
    await t.test('Section E: Authenticated Founder and Investor profile editing with schema constraints', async () => {
      // 1. Founder reads own profile
      const founderGetRes = await fetch(`${API_BASE}/founder/profile`, {
        headers: { Cookie: founder.cookie },
      });
      assert.equal(founderGetRes.status, 200, 'Founder reads own profile');
      const founderGetJson = await founderGetRes.json();
      assert.equal(founderGetJson.profile.userId, founder.userId);

      // 2. Founder updates profile
      const founderUpdateRes = await fetch(`${API_BASE}/founder/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: founder.cookie },
        body: JSON.stringify({
          firstName: 'Ananya',
          lastName: 'Sharma',
          city: 'Hyderabad',
          highestEducation: 'Master of Technology',
          priorStartupsCount: 3,
        }),
      });
      assert.equal(founderUpdateRes.status, 200, 'Founder updates profile');
      const founderUpdateJson = await founderUpdateRes.json();
      assert.equal(founderUpdateJson.profile.firstName, 'Ananya');
      assert.equal(founderUpdateJson.profile.highestEducation, 'Master of Technology');
      assert.equal(founderUpdateJson.profile.priorStartupsCount, 3);
      assert.equal(founderUpdateJson.profile.city, 'Hyderabad');

      // 3. Founder cannot access or update Investor profile -> 403
      const crossRoleGet = await fetch(`${API_BASE}/investor/profile`, {
        headers: { Cookie: founder.cookie },
      });
      assert.equal(crossRoleGet.status, 403, 'Founder receives 403 on investor profile');

      // 4. Investor reads own profile
      const invGetRes = await fetch(`${API_BASE}/investor/profile`, {
        headers: { Cookie: investor1.cookie },
      });
      assert.equal(invGetRes.status, 200, 'Investor reads own profile');
      const invGetJson = await invGetRes.json();
      assert.equal(invGetJson.profile.userId, investor1.userId);

      // 5. Investor updates profile with amounts and preferences
      const invUpdateRes = await fetch(`${API_BASE}/investor/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: investor1.cookie },
        body: JSON.stringify({
          displayName: 'Vikram Ventures',
          investmentFirmName: 'Apex Growth Partners',
          biography: 'Focusing on seed and pre-series A SaaS startups.',
          minInvestmentAmount: 25000,
          maxInvestmentAmount: 500000,
          isAcceptingPitches: true,
          industryPreferences: [testIndustryId!],
        }),
      });
      assert.equal(invUpdateRes.status, 200, 'Investor updates profile');
      const invUpdateJson = await invUpdateRes.json();
      assert.equal(invUpdateJson.profile.displayName, 'Vikram Ventures');
      assert.equal(invUpdateJson.profile.biography, 'Focusing on seed and pre-series A SaaS startups.');
      assert.deepEqual(invUpdateJson.profile.industryPreferences, [testIndustryId]);

      // 6. Invalid values rejected: minInvestmentAmount > maxInvestmentAmount -> 400
      const invalidAmountRes = await fetch(`${API_BASE}/investor/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: investor1.cookie },
        body: JSON.stringify({ minInvestmentAmount: 900000, maxInvestmentAmount: 100000 }),
      });
      assert.equal(invalidAmountRes.status, 400, 'min > max returns 400 INVALID_INPUT');

      // 7. Rejection of privileged fields
      const privFieldRes = await fetch(`${API_BASE}/founder/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: founder.cookie },
        body: JSON.stringify({ userId: 99999, role: 'ADMIN' }),
      });
      assert.equal(privFieldRes.status, 400, 'Attempting to set privileged field returns 400');
    });

    // ========================================================================
    // F. Correct account-linking recovery guidance
    // ========================================================================
    await t.test('Section F: Account linking recovery guidance in Google auth endpoint', async () => {
      // 1. Create a user with email and legacy password hash (no google_subject)
      const existingEmail = `existing_user_${runId}@sauda.test`;
      const [uRes] = await dbPool.execute<ResultSetHeader>(
        `INSERT INTO app_user (full_name, email, google_subject, password_hash, account_status)
         VALUES ('Existing Pre-Google User', ?, NULL, 'legacy_pw_hash_for_test', 'ACTIVE')`,
        [existingEmail],
      );
      createdUserIds.push(uRes.insertId);

      // 2. Call authenticateOrProvisionGoogleUser directly with that email and a new Google subject
      const authRes = await authenticateOrProvisionGoogleUser({
        email: existingEmail,
        sub: `new_google_sub_${runId}`,
        name: 'Existing User',
      });

      // It must reject with 409 ACCOUNT_LINKING_REQUIRED and actionable guidance
      assert.equal(authRes.success, false, 'Account linking must not auto-link');
      if (!authRes.success) {
        assert.equal(authRes.status, 409, 'Account linking returns 409');
        assert.equal(authRes.error, 'ACCOUNT_LINKING_REQUIRED');
        assert.doesNotMatch(authRes.message, /password/i, 'Does not advise password login');
        assert.match(authRes.message, /support@sauda\.internal/, 'Advises contacting designated support email');
      }

      // Verify database row was NOT silently updated with the new google_subject
      const [userCheck] = await dbPool.execute<RowDataPacket[]>(
        'SELECT google_subject FROM app_user WHERE email = ?',
        [existingEmail],
      );
      assert.equal(userCheck[0].google_subject, null, 'User google_subject is NOT modified');
    });
  } finally {
    await cleanup();
    await dbPool.end();
  }
});
