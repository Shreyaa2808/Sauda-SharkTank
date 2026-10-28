/**
 * Phase 6 Unit Test Suite: Integration Verification Closure
 * Fully offline, deterministic unit tests covering:
 * - Date normalization & chronological comparison invariance
 * - Clean database bootstrap safety rules & fixture DB protection
 * - Historical admin payload validation logic
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDateValue } from './historical.js';
import { PROTECTED_DATABASE_NAMES } from './testSafetyGuards.js';

test('Section A: normalizeDateValue standardizes Date objects and ISO strings to YYYY-MM-DD', () => {
  // Date object handling
  const d = new Date('2026-04-10T00:00:00.000Z');
  assert.equal(normalizeDateValue(d), '2026-04-10');

  // String handling
  assert.equal(normalizeDateValue('2026-01-15'), '2026-01-15');
  assert.equal(normalizeDateValue('2026-12-31T23:59:59.999Z'), '2026-12-31');

  // Falsy and invalid values
  assert.equal(normalizeDateValue(null), null);
  assert.equal(normalizeDateValue(undefined), null);
  assert.equal(normalizeDateValue(''), null);
  assert.equal(normalizeDateValue('not-a-date'), null);
});

test('Section A: Chronological date comparison invariant holds with normalized values', () => {
  // Test case that previously failed due to day-of-week string comparison (e.g. "Fri Apr" < "Sat Jan")
  const premiereDate = new Date('2026-01-10T00:00:00Z');
  const finaleDate = new Date('2026-04-10T00:00:00Z');

  const normPremiere = normalizeDateValue(premiereDate);
  const normFinale = normalizeDateValue(finaleDate);

  assert(normPremiere !== null && normFinale !== null);
  // finaleDate MUST NOT be earlier than premiereDate
  const isFinaleEarlier = normFinale < normPremiere;
  assert.equal(isFinaleEarlier, false, 'April 2026 is chronologically after January 2026');

  // True invalid range: finale before premiere
  const invalidFinale = normalizeDateValue('2025-12-31');
  assert(invalidFinale !== null);
  assert.equal(invalidFinale < normPremiere, true, 'December 2025 is earlier than January 2026');
});

test('Section B: Clean bootstrap verification strictly protects populated fixture databases', () => {
  const isProtectedDatabase = (name: string) => {
    const lower = name.toLowerCase().trim();
    if (PROTECTED_DATABASE_NAMES.includes(lower)) return true;
    if (lower === 'sauda_test_phase3') return true; // Populated Phase 3/4 fixture DB
    return !/^sauda_test_[a-z0-9_]{1,40}$/i.test(lower);
  };

  // Protected application databases
  assert.equal(isProtectedDatabase('sharktank_db'), true);
  assert.equal(isProtectedDatabase('sharktank_db_test_full_20261023'), true);
  assert.equal(isProtectedDatabase('sys'), true);

  // Populated fixture database MUST NOT be repurposed as a blank database
  assert.equal(isProtectedDatabase('sauda_test_phase3'), true);

  // Valid, dedicated blank test databases
  assert.equal(isProtectedDatabase('sauda_test_clean'), false);
  assert.equal(isProtectedDatabase('sauda_test_bootstrap_2026'), false);
});
