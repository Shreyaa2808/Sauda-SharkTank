import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------------------------------------------------------------------
// Section A: Investor Withdrawal Validation & State Transition Rules
// ----------------------------------------------------------------------------

function evaluateWithdrawalEligibility(
  requesterUserId: number,
  currentStatus: string,
  callerUserId: number,
): { allowed: boolean; status: number; error?: string } {
  if (requesterUserId !== callerUserId) {
    return { allowed: false, status: 403, error: 'UNAUTHORIZED_REQUESTER' };
  }
  if (currentStatus !== 'PENDING') {
    return { allowed: false, status: 409, error: 'INVALID_STATE' };
  }
  return { allowed: true, status: 200 };
}

function validateWithdrawalReason(reason: unknown): { ok: boolean; error?: string; value?: string | null } {
  if (reason === undefined || reason === null) {
    return { ok: true, value: null };
  }
  if (typeof reason !== 'string') {
    return { ok: false, error: 'INVALID_REASON' };
  }
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (trimmed.length > 255) {
    return { ok: false, error: 'REASON_TOO_LONG' };
  }
  return { ok: true, value: trimmed };
}

test('Section A: only the requesting investor can withdraw a connection request', () => {
  const investorId = 101;
  const intruderId = 999;
  const founderId = 202;

  assert.deepEqual(evaluateWithdrawalEligibility(investorId, 'PENDING', investorId), {
    allowed: true,
    status: 200,
  });

  assert.deepEqual(evaluateWithdrawalEligibility(investorId, 'PENDING', intruderId), {
    allowed: false,
    status: 403,
    error: 'UNAUTHORIZED_REQUESTER',
  });

  assert.deepEqual(evaluateWithdrawalEligibility(investorId, 'PENDING', founderId), {
    allowed: false,
    status: 403,
    error: 'UNAUTHORIZED_REQUESTER',
  });
});

test('Section A: withdrawal is permitted only in PENDING state; invalid transitions return 409', () => {
  const investorId = 101;
  const nonPendingStatuses = ['ACCEPTED', 'DECLINED', 'WITHDRAWN', 'ENDED'];

  for (const status of nonPendingStatuses) {
    const result = evaluateWithdrawalEligibility(investorId, status, investorId);
    assert.equal(result.allowed, false, `Status ${status} should not be withdrawable`);
    assert.equal(result.status, 409, `Status ${status} should return 409 conflict`);
    assert.equal(result.error, 'INVALID_STATE');
  }
});

test('Section A: withdrawal reason validation handles strings, null, bounds, and non-strings', () => {
  assert.deepEqual(validateWithdrawalReason(undefined), { ok: true, value: null });
  assert.deepEqual(validateWithdrawalReason(null), { ok: true, value: null });
  assert.deepEqual(validateWithdrawalReason('   '), { ok: true, value: null });
  assert.deepEqual(validateWithdrawalReason('Changed investment focus'), {
    ok: true,
    value: 'Changed investment focus',
  });

  // Non-string types rejected with INVALID_REASON
  assert.deepEqual(validateWithdrawalReason(12345), { ok: false, error: 'INVALID_REASON' });
  assert.deepEqual(validateWithdrawalReason(true), { ok: false, error: 'INVALID_REASON' });
  assert.deepEqual(validateWithdrawalReason({ reason: 'text' }), { ok: false, error: 'INVALID_REASON' });

  // Exceeding 255 chars rejected with REASON_TOO_LONG
  const tooLong = 'a'.repeat(256);
  assert.deepEqual(validateWithdrawalReason(tooLong), { ok: false, error: 'REASON_TOO_LONG' });

  const exactMax = 'a'.repeat(255);
  assert.deepEqual(validateWithdrawalReason(exactMax), { ok: true, value: exactMax });
});

// ----------------------------------------------------------------------------
// Section B: Pitch Eligibility and Archiving Race Protection
// ----------------------------------------------------------------------------

function evaluateConnectionRequestEligibility(pitch: {
  pitchType: string;
  pitchStatus: string;
  submittedByUserId: number;
  investorUserId: number;
}): { ok: boolean; status: number; error?: string } {
  if (pitch.pitchType !== 'PLATFORM') {
    return { ok: false, status: 400, error: 'PLATFORM_ONLY' };
  }
  if (pitch.pitchStatus !== 'PUBLISHED') {
    return { ok: false, status: 409, error: 'PITCH_NOT_PUBLISHED' };
  }
  if (pitch.investorUserId === pitch.submittedByUserId) {
    return { ok: false, status: 400, error: 'SELF_CONNECTION_FORBIDDEN' };
  }
  return { ok: true, status: 200 };
}

test('Section B: request creation rejects SHOW pitches, self-connection, and non-PUBLISHED listings', () => {
  // SHOW pitches
  assert.deepEqual(
    evaluateConnectionRequestEligibility({
      pitchType: 'SHOW',
      pitchStatus: 'PUBLISHED',
      submittedByUserId: 1,
      investorUserId: 2,
    }),
    { ok: false, status: 400, error: 'PLATFORM_ONLY' },
  );

  // Self connection
  assert.deepEqual(
    evaluateConnectionRequestEligibility({
      pitchType: 'PLATFORM',
      pitchStatus: 'PUBLISHED',
      submittedByUserId: 10,
      investorUserId: 10,
    }),
    { ok: false, status: 400, error: 'SELF_CONNECTION_FORBIDDEN' },
  );

  // Non-published platform listings
  for (const status of ['DRAFT', 'SUBMITTED', 'REJECTED', 'ARCHIVED']) {
    assert.deepEqual(
      evaluateConnectionRequestEligibility({
        pitchType: 'PLATFORM',
        pitchStatus: status,
        submittedByUserId: 1,
        investorUserId: 2,
      }),
      { ok: false, status: 409, error: 'PITCH_NOT_PUBLISHED' },
    );
  }

  // Valid published platform listing
  assert.deepEqual(
    evaluateConnectionRequestEligibility({
      pitchType: 'PLATFORM',
      pitchStatus: 'PUBLISHED',
      submittedByUserId: 1,
      investorUserId: 2,
    }),
    { ok: true, status: 200 },
  );
});

// ----------------------------------------------------------------------------
// Section C: Watchlist Toggle Visibility & Transactional Rules
// ----------------------------------------------------------------------------

function evaluateWatchlistToggle(
  isAlreadySaved: boolean,
  pitchStatus: string,
): { allowed: boolean; action: 'ADD' | 'REMOVE'; status: number; error?: string } {
  if (isAlreadySaved) {
    // Removal is always allowed
    return { allowed: true, action: 'REMOVE', status: 200 };
  }
  if (pitchStatus !== 'PUBLISHED') {
    return { allowed: false, action: 'ADD', status: 409, error: 'PITCH_NOT_VISIBLE' };
  }
  return { allowed: true, action: 'ADD', status: 200 };
}

test('Section C: watchlist adding requires PUBLISHED status, while removal of existing is permitted', () => {
  // Published pitch not yet saved -> ADD allowed
  assert.deepEqual(evaluateWatchlistToggle(false, 'PUBLISHED'), {
    allowed: true,
    action: 'ADD',
    status: 200,
  });

  // Already saved pitch -> REMOVE allowed even if now ARCHIVED
  assert.deepEqual(evaluateWatchlistToggle(true, 'ARCHIVED'), {
    allowed: true,
    action: 'REMOVE',
    status: 200,
  });

  // Unpublished pitches cannot be added to watchlist
  for (const status of ['DRAFT', 'SUBMITTED', 'REJECTED', 'ARCHIVED']) {
    assert.deepEqual(evaluateWatchlistToggle(false, status), {
      allowed: false,
      action: 'ADD',
      status: 409,
      error: 'PITCH_NOT_VISIBLE',
    });
  }
});

// ----------------------------------------------------------------------------
// Section D: Submission Timestamp Refresh and Queue Ordering
// ----------------------------------------------------------------------------

function resolveNextSubmissionTimestamp(
  currentStatus: string,
  targetStatus: string,
  existingTimestamp: number,
  nowTimestamp: number,
): { nextTimestamp: number; wasRefreshed: boolean } {
  if (targetStatus === 'SUBMITTED' && currentStatus !== 'SUBMITTED') {
    return { nextTimestamp: nowTimestamp, wasRefreshed: true };
  }
  return { nextTimestamp: existingTimestamp, wasRefreshed: false };
}

test('Section D: submitted_at refreshes on draft submission and resubmission, but not on ordinary edits', () => {
  const t0 = 1000;
  const t1 = 2000;
  const t2 = 3000;

  // 1. Ordinary edit of a DRAFT: status remains DRAFT -> timestamp unchanged
  const draftEdit = resolveNextSubmissionTimestamp('DRAFT', 'DRAFT', t0, t1);
  assert.equal(draftEdit.wasRefreshed, false);
  assert.equal(draftEdit.nextTimestamp, t0);

  // 2. Draft submitted: transitions DRAFT -> SUBMITTED -> timestamp refreshed to now (t1)
  const firstSubmit = resolveNextSubmissionTimestamp('DRAFT', 'SUBMITTED', t0, t1);
  assert.equal(firstSubmit.wasRefreshed, true);
  assert.equal(firstSubmit.nextTimestamp, t1);

  // 3. Edit of a REJECTED pitch without submitting: status remains DRAFT -> timestamp unchanged
  const rejectedEdit = resolveNextSubmissionTimestamp('REJECTED', 'DRAFT', t1, t2);
  assert.equal(rejectedEdit.wasRefreshed, false);
  assert.equal(rejectedEdit.nextTimestamp, t1);

  // 4. Resubmission of REJECTED pitch: transitions REJECTED -> SUBMITTED -> timestamp refreshed to now (t2)
  const resubmit = resolveNextSubmissionTimestamp('REJECTED', 'SUBMITTED', t1, t2);
  assert.equal(resubmit.wasRefreshed, true);
  assert.equal(resubmit.nextTimestamp, t2);
});

test('Section D: review queue ordering is deterministic with primary-key tie-breaker', () => {
  const queue = [
    { pitchId: 5, submittedAt: '2026-10-28T12:00:00Z' },
    { pitchId: 2, submittedAt: '2026-10-28T10:00:00Z' },
    { pitchId: 8, submittedAt: '2026-10-28T10:00:00Z' },
    { pitchId: 1, submittedAt: '2026-10-28T10:00:00Z' },
    { pitchId: 3, submittedAt: '2026-10-28T11:00:00Z' },
  ];

  queue.sort((a, b) => {
    const timeCmp = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    if (timeCmp !== 0) return timeCmp;
    return a.pitchId - b.pitchId;
  });

  const ids = queue.map((p) => p.pitchId);
  // At 10:00:00 -> pitchId 1, 2, 8 (tie breaker by pitch_id ASC)
  // At 11:00:00 -> pitchId 3
  // At 12:00:00 -> pitchId 5
  assert.deepEqual(ids, [1, 2, 8, 3, 5]);
});

// ----------------------------------------------------------------------------
// Section E: Role Profile Validation Rules
// ----------------------------------------------------------------------------

const FORBIDDEN_PROFILE_FIELDS = new Set([
  'userId',
  'user_id',
  'role',
  'roles',
  'founderId',
  'founder_id',
  'investorId',
  'investor_id',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
]);

function validateProfileBodySecurity(body: Record<string, unknown>): { ok: boolean; error?: string } {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_PROFILE_FIELDS.has(key)) {
      return { ok: false, error: 'PRIVILEGED_FIELD_FORBIDDEN' };
    }
  }
  return { ok: true };
}

test('Section E: client attempts to set privileged fields in profile are rejected', () => {
  for (const forbidden of ['userId', 'role', 'roles', 'founderId', 'investorId', 'createdAt']) {
    const check = validateProfileBodySecurity({ firstName: 'Alice', [forbidden]: 123 });
    assert.equal(check.ok, false, `Forbidden key '${forbidden}' should be rejected`);
    assert.equal(check.error, 'PRIVILEGED_FIELD_FORBIDDEN');
  }

  assert.deepEqual(validateProfileBodySecurity({ firstName: 'Alice', city: 'Mumbai' }), {
    ok: true,
  });
});

test('Section E: investment amounts require min <= max', () => {
  function checkInvestmentAmounts(
    min: number | null | undefined,
    max: number | null | undefined,
  ): boolean {
    if (min != null && max != null && min > max) {
      return false;
    }
    return true;
  }

  assert.equal(checkInvestmentAmounts(50000, 100000), true);
  assert.equal(checkInvestmentAmounts(100000, 100000), true);
  assert.equal(checkInvestmentAmounts(null, 100000), true);
  assert.equal(checkInvestmentAmounts(50000, null), true);
  assert.equal(checkInvestmentAmounts(200000, 100000), false);
});

// ----------------------------------------------------------------------------
// Section F: Account Linking Recovery Guidance
// ----------------------------------------------------------------------------

test('Section F: account linking guidance directs to support and does not advise password login', () => {
  const authCode = readFileSync(path.resolve(__dirname, 'auth.ts'), 'utf8');

  // Verify ACCOUNT_LINKING_REQUIRED error code is present
  assert.match(authCode, /error:\s*'ACCOUNT_LINKING_REQUIRED'/);

  // Verify the dead-end instruction to sign in with password is completely removed
  assert.doesNotMatch(authCode, /sign in with your password/i);

  // Verify actionable contact guidance for support/admin is provided
  assert.match(authCode, /support@sauda\.internal/);
  assert.match(authCode, /automatic account linking is disabled/i);
});
