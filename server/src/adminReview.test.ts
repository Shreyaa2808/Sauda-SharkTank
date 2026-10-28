import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRoleAccess,
  founderMayReadPitchReviewHistory,
  parseReviewDecisionInput,
  resolveReviewTransition,
} from './adminReview.js';

test('unauthenticated callers are rejected with 401 before role access', () => {
  assert.deepEqual(evaluateRoleAccess(false, [], ['ADMIN']), { allowed: false, status: 401, error: 'UNAUTHORIZED' });
});

test('authenticated non-admin roles cannot access the Admin review queue', () => {
  for (const role of ['VIEWER', 'FOUNDER', 'INVESTOR']) {
    assert.deepEqual(evaluateRoleAccess(true, [role], ['ADMIN']), { allowed: false, status: 403, error: 'FORBIDDEN' });
  }
  assert.deepEqual(evaluateRoleAccess(true, ['VIEWER', 'ADMIN'], ['ADMIN']), { allowed: true });
});

test('publish decisions accept an omitted note and trim optional notes', () => {
  assert.deepEqual(parseReviewDecisionInput({ decision: 'PUBLISH' }), { ok: true, value: { decision: 'PUBLISH', note: null } });
  assert.deepEqual(parseReviewDecisionInput({ decision: 'PUBLISH', note: '  Looks good  ' }), { ok: true, value: { decision: 'PUBLISH', note: 'Looks good' } });
});

test('reject decisions require meaningful feedback of at least 10 characters', () => {
  for (const note of [undefined, null, '', '   ', 'too short']) {
    const result = parseReviewDecisionInput({ decision: 'REJECT', note });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'REJECTION_NOTE_REQUIRED');
  }
  assert.deepEqual(parseReviewDecisionInput({ decision: 'REJECT', note: 'Please add financial details.' }), { ok: true, value: { decision: 'REJECT', note: 'Please add financial details.' } });
});

test('invalid decisions, invalid note types, and oversized notes are rejected', () => {
  assert.equal(parseReviewDecisionInput({ decision: 'ARCHIVE' }).ok, false);
  assert.equal(parseReviewDecisionInput({ decision: 'PUBLISH', note: 123 }).ok, false);
  const tooLong = parseReviewDecisionInput({ decision: 'PUBLISH', note: 'x'.repeat(2001) });
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.equal(tooLong.error, 'REVIEW_NOTE_TOO_LONG');
});

test('submitted PLATFORM pitches can be published or rejected', () => {
  assert.deepEqual(resolveReviewTransition('PLATFORM', 'SUBMITTED', 'PUBLISH'), { ok: true, nextStatus: 'PUBLISHED' });
  assert.deepEqual(resolveReviewTransition('PLATFORM', 'SUBMITTED', 'REJECT'), { ok: true, nextStatus: 'REJECTED' });
});

test('SHOW, draft, rejected, published, and archived pitches cannot be decided through the queue', () => {
  assert.equal(resolveReviewTransition('SHOW', 'SUBMITTED', 'PUBLISH').error, 'SHOW_PITCH_IMMUTABLE');
  for (const status of ['DRAFT', 'PUBLISHED', 'REJECTED', 'ARCHIVED']) {
    assert.equal(resolveReviewTransition('PLATFORM', status, 'PUBLISH').error, 'PITCH_NOT_REVIEWABLE');
  }
});

test('a second decision after the first transition is not allowed (sequential race invariant)', () => {
  const first = resolveReviewTransition('PLATFORM', 'SUBMITTED', 'PUBLISH');
  assert.equal(first.nextStatus, 'PUBLISHED');
  assert.equal(resolveReviewTransition('PLATFORM', first.nextStatus!, 'REJECT').ok, false);
});

test('founders can read history only for their own PLATFORM pitch', () => {
  assert.equal(founderMayReadPitchReviewHistory(42, 'PLATFORM', 42), true);
  assert.equal(founderMayReadPitchReviewHistory(42, 'PLATFORM', 43), false);
  assert.equal(founderMayReadPitchReviewHistory(42, 'SHOW', null), false);
  assert.equal(founderMayReadPitchReviewHistory(42, 'PLATFORM', null), false);
});
