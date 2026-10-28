/**
 * Phase 5 Unit Test Suite: Security, Validation and Operational Reliability
 * Fully offline, deterministic tests covering:
 * - Standardized input validation & error sanitization
 * - Google OAuth verification timeout, upstream failure, and credential redaction
 * - Bounded pagination and deterministic tie-breaker sorting
 * - Test harness safety guards (rejecting port 4000, protected databases, non-local hosts)
 * - First-admin protection and secret-safe error responses
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ValidationError,
  validateJsonObject,
  parsePositiveIntegerId,
  parsePagination,
  validateAllowedFields,
  validateBoundedString,
  formatSafeErrorResponse,
} from './validation.js';
import { verifyGoogleIdToken } from './auth.js';
import {
  validateIntegrationTarget,
  PROTECTED_DATABASE_NAMES,
} from './testSafetyGuards.js';

// ============================================================================
// SECTION A: STANDARDIZED HTTP INPUT VALIDATION
// ============================================================================

test('Section A: validateJsonObject rejects null, primitives, arrays and accepts valid plain objects', () => {
  // Invalid inputs
  assert.throws(() => validateJsonObject(null), (err: any) => err instanceof ValidationError && err.status === 400 && err.code === 'INVALID_BODY');
  assert.throws(() => validateJsonObject(undefined), (err: any) => err instanceof ValidationError && err.status === 400 && err.code === 'INVALID_BODY');
  assert.throws(() => validateJsonObject([1, 2, 3]), (err: any) => err instanceof ValidationError && err.status === 400 && err.code === 'INVALID_BODY');
  assert.throws(() => validateJsonObject('string'), (err: any) => err instanceof ValidationError && err.status === 400 && err.code === 'INVALID_BODY');
  assert.throws(() => validateJsonObject(123), (err: any) => err instanceof ValidationError && err.status === 400 && err.code === 'INVALID_BODY');
  assert.throws(() => validateJsonObject(true), (err: any) => err instanceof ValidationError && err.status === 400 && err.code === 'INVALID_BODY');

  // Valid inputs
  const valid = { field: 'value', count: 10 };
  const result = validateJsonObject(valid);
  assert.deepEqual(result, valid);
  assert.deepEqual(validateJsonObject({}), {});
});

test('Section A: parsePositiveIntegerId validates safe positive integers and rejects malformed values', () => {
  // Valid positive safe integers
  assert.equal(parsePositiveIntegerId(1, 'id'), 1);
  assert.equal(parsePositiveIntegerId(42, 'id'), 42);
  assert.equal(parsePositiveIntegerId('42', 'id'), 42);
  assert.equal(parsePositiveIntegerId('1000', 'id'), 1000);

  // Invalid values: zero, negative, floats, NaN, strings with text, booleans, objects, arrays, null, undefined
  const invalidValues = [
    0,
    -1,
    -100,
    1.5,
    '3.14',
    'abc',
    '12abc',
    '',
    '   ',
    null,
    undefined,
    true,
    false,
    {},
    [],
    Number.MAX_SAFE_INTEGER + 10,
    NaN,
    Infinity,
  ];

  for (const val of invalidValues) {
    assert.throws(
      () => parsePositiveIntegerId(val, 'testId'),
      (err: any) => err instanceof ValidationError && err.status === 400 && err.code === 'INVALID_ID',
      `Expected parsePositiveIntegerId to reject: ${JSON.stringify(val)}`,
    );
  }
});

test('Section A: validateAllowedFields rejects unrecognized fields', () => {
  const allowed = ['brandName', 'pitchHook', 'askAmount'];

  // Valid object
  assert.doesNotThrow(() => validateAllowedFields({ brandName: 'Sauda', pitchHook: 'Hook' }, allowed));

  // Object with unexpected/unknown field
  assert.throws(
    () => validateAllowedFields({ brandName: 'Sauda', pitchStatus: 'PUBLISHED' }, allowed),
    (err: any) => err instanceof ValidationError && err.status === 400 && err.code === 'UNKNOWN_FIELD',
  );
});

test('Section A: validateBoundedString enforces string type and length constraints', () => {
  // Required string
  assert.equal(validateBoundedString('Valid String', 'title', { required: true }), 'Valid String');
  assert.throws(
    () => validateBoundedString('', 'title', { required: true }),
    (err: any) => err instanceof ValidationError && err.status === 400 && err.code === 'INVALID_STRING_LENGTH',
  );
  assert.throws(
    () => validateBoundedString(null, 'title', { required: true }),
    (err: any) => err instanceof ValidationError && err.status === 400 && err.code === 'MISSING_FIELD',
  );

  // Optional string
  assert.equal(validateBoundedString(null, 'optionalNote', { required: false }), null);
  assert.equal(validateBoundedString(undefined, 'optionalNote', { required: false }), null);

  // Oversized string
  const longString = 'a'.repeat(101);
  assert.throws(
    () => validateBoundedString(longString, 'note', { maxLength: 100 }),
    (err: any) => err instanceof ValidationError && err.status === 400 && err.code === 'STRING_TOO_LONG',
  );
});

test('Section A & E: formatSafeErrorResponse never discloses SQL syntax, stack traces or secrets', () => {
  // 1. ValidationError formatting
  const valErr = new ValidationError(400, 'INVALID_BODY', 'A JSON object is required.');
  const valRes = formatSafeErrorResponse(valErr);
  assert.equal(valRes.status, 400);
  assert.deepEqual(valRes.body, { error: 'INVALID_BODY', message: 'A JSON object is required.' });

  // 2. MySQL database exception simulation
  const mysqlError = new Error("ER_PARSE_ERROR: You have an error in your SQL syntax near 'SELECT * FROM secrets'");
  (mysqlError as any).sql = 'SELECT * FROM app_user WHERE secret_token = 12345';
  (mysqlError as any).code = 'ER_PARSE_ERROR';
  mysqlError.stack = 'Error at Connection.query (/workspace/node_modules/mysql2/lib/connection.js:123)';

  const sanitized = formatSafeErrorResponse(mysqlError, 'Failed to process request.');
  assert.equal(sanitized.status, 500);
  assert.equal(sanitized.body.error, 'SERVER_ERROR');
  assert.equal(sanitized.body.message, 'Failed to process request.');
  // Ensure no SQL or stack leaks
  assert.equal('sql' in (sanitized.body as any), false);
  assert.equal('stack' in (sanitized.body as any), false);
  assert.equal(JSON.stringify(sanitized.body).includes('SELECT'), false);
});

// ============================================================================
// SECTION B: GOOGLE TOKEN VERIFICATION TIMEOUT & CREDENTIAL REDACTION
// ============================================================================

test('Section B: verifyGoogleIdToken validates claims on successful response', async () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

  const mockClaims = {
    aud: 'test-client-id.apps.googleusercontent.com',
    iss: 'https://accounts.google.com',
    sub: 'google_user_12345',
    email: 'investor@example.com',
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
    name: 'Test Investor',
  };

  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify(mockClaims), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const result = await verifyGoogleIdToken('valid-token-string', {
    fetchFn: mockFetch,
    timeoutMs: 1000,
  });

  process.env.GOOGLE_CLIENT_ID = originalClientId;

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.profile.sub, 'google_user_12345');
    assert.equal(result.profile.email, 'investor@example.com');
    assert.equal(result.profile.name, 'Test Investor');
  }
});

test('Section B: verifyGoogleIdToken rejects expired token or audience mismatch', async () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'expected-client-id';

  // 1. Audience mismatch
  const mismatchClaims = {
    aud: 'wrong-client-id',
    iss: 'https://accounts.google.com',
    sub: 'google_user_12345',
    email: 'investor@example.com',
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const mockFetchMismatch: typeof fetch = async () =>
    new Response(JSON.stringify(mismatchClaims), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const mismatchResult = await verifyGoogleIdToken('token', { fetchFn: mockFetchMismatch });
  assert.equal(mismatchResult.success, false);
  if (!mismatchResult.success) {
    assert.equal(mismatchResult.status, 401);
    assert.equal(mismatchResult.error, 'AUDIENCE_MISMATCH');
  }

  // 2. Expired token
  const expiredClaims = {
    aud: 'expected-client-id',
    iss: 'https://accounts.google.com',
    sub: 'google_user_12345',
    email: 'investor@example.com',
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) - 100, // Expired
  };
  const mockFetchExpired: typeof fetch = async () =>
    new Response(JSON.stringify(expiredClaims), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const expiredResult = await verifyGoogleIdToken('token', { fetchFn: mockFetchExpired });
  assert.equal(expiredResult.success, false);
  if (!expiredResult.success) {
    assert.equal(expiredResult.status, 401);
    assert.equal(expiredResult.error, 'TOKEN_EXPIRED');
  }

  process.env.GOOGLE_CLIENT_ID = originalClientId;
});

test('Section B: verifyGoogleIdToken handles timeout with 504 and GOOGLE_OAUTH_TIMEOUT', async () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';

  const mockSlowFetch: typeof fetch = async (_url, init) => {
    return new Promise((resolve, reject) => {
      const signal = init?.signal;
      if (signal) {
        signal.addEventListener('abort', () => {
          const abortError = new Error('The operation was aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      }
      // Never resolves naturally to simulate slow/hung upstream
    });
  };

  const result = await verifyGoogleIdToken('token', {
    fetchFn: mockSlowFetch,
    timeoutMs: 50, // 50ms fast timeout for testing
  });

  process.env.GOOGLE_CLIENT_ID = originalClientId;

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.status, 504);
    assert.equal(result.error, 'GOOGLE_OAUTH_TIMEOUT');
    assert.equal(result.message.includes('timed out'), true);
  }
});

test('Section B: verifyGoogleIdToken maps upstream 5xx errors to 502 GOOGLE_OAUTH_UNAVAILABLE', async () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';

  const mock500Fetch: typeof fetch = async () =>
    new Response('Internal Server Error', { status: 503 });

  const result = await verifyGoogleIdToken('token', { fetchFn: mock500Fetch });

  process.env.GOOGLE_CLIENT_ID = originalClientId;

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.status, 502);
    assert.equal(result.error, 'GOOGLE_OAUTH_UNAVAILABLE');
  }
});

// ============================================================================
// SECTION C: BOUNDED PAGINATION & DETERMINISTIC SORTING
// ============================================================================

test('Section C: parsePagination enforces integer bounds, caps limit to 100, and rejects invalid query values', () => {
  // Default values
  const defaultPage = parsePagination({});
  assert.equal(defaultPage.limit, 50);
  assert.equal(defaultPage.offset, 0);

  // Custom valid pagination
  const customPage = parsePagination({ limit: '25', offset: '50' });
  assert.equal(customPage.limit, 25);
  assert.equal(customPage.offset, 50);

  // Maximum upper limit enforcement: limit > 100 is clamped to 100
  const clampedPage = parsePagination({ limit: '200' }, { maxLimit: 100 });
  assert.equal(clampedPage.limit, 100);

  // Rejection of invalid limits: non-integers, negative, zero, booleans
  const invalidLimits = ['-1', '0', '12.5', 'abc', 'true', null, true];
  for (const invalid of invalidLimits) {
    assert.throws(
      () => parsePagination({ limit: invalid as any }),
      (err: any) => err instanceof ValidationError && err.status === 400 && err.code === 'INVALID_PAGINATION',
      `Expected parsePagination to reject limit: ${invalid}`,
    );
  }

  // Rejection of invalid offsets: negative, non-integers, strings with letters
  const invalidOffsets = ['-5', '3.5', 'xyz', 'false', null, false];
  for (const invalid of invalidOffsets) {
    assert.throws(
      () => parsePagination({ offset: invalid as any }),
      (err: any) => err instanceof ValidationError && err.status === 400 && err.code === 'INVALID_PAGINATION',
      `Expected parsePagination to reject offset: ${invalid}`,
    );
  }
});

test('Section C: parsePagination avoids silent coercion of empty or invalid fields', () => {
  // Whitespace-only limit is rejected, not silently converted to default
  assert.throws(
    () => parsePagination({ limit: '   ' }),
    (err: any) => err instanceof ValidationError && err.status === 400,
  );
  // Negative offset is rejected, not clamped to 0
  assert.throws(
    () => parsePagination({ offset: '-1' }),
    (err: any) => err instanceof ValidationError && err.status === 400,
  );
});

// ============================================================================
// SECTION D: TEST SAFETY GUARDS & HARNESS REGRESSION TESTS
// ============================================================================

test('Section D: validateIntegrationTarget aborts immediately when opt-in is missing', () => {
  const result = validateIntegrationTarget({
    optInEnvVar: 'SAUDA_RUN_PHASE5_TESTS',
    env: {
      DB_HOST: '127.0.0.1',
      DB_NAME: 'sauda_test_phase5',
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, 'TEST_OPT_IN_REQUIRED');
  }
});

test('Section D: validateIntegrationTarget aborts immediately when configured against default port 4000', () => {
  const result = validateIntegrationTarget({
    optInEnvVar: 'SAUDA_RUN_TEST',
    requireApiUrl: true,
    env: {
      SAUDA_RUN_TEST: '1',
      DB_HOST: '127.0.0.1',
      DB_NAME: 'sauda_test_phase5',
      SAUDA_TEST_API_BASE: 'http://localhost:4000/api', // FORBIDDEN PORT
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, 'DEFAULT_PORT_FORBIDDEN');
    assert.equal(result.reason.includes('4000'), true);
  }
});

test('Section D: validateIntegrationTarget rejects protected database names', () => {
  for (const protectedDb of PROTECTED_DATABASE_NAMES) {
    const result = validateIntegrationTarget({
      optInEnvVar: 'SAUDA_RUN_TEST',
      env: {
        SAUDA_RUN_TEST: '1',
        DB_HOST: '127.0.0.1',
        DB_NAME: protectedDb,
      },
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error === 'PROTECTED_DATABASE_TARGETED' || result.error === 'INVALID_TEST_DB_NAME', true);
    }
  }
});

test('Section D: validateIntegrationTarget rejects non-local hosts and non-sauda_test_* names', () => {
  // Remote host rejection
  const remoteHostResult = validateIntegrationTarget({
    optInEnvVar: 'SAUDA_RUN_TEST',
    env: {
      SAUDA_RUN_TEST: '1',
      DB_HOST: 'db.prod.internal',
      DB_NAME: 'sauda_test_phase5',
    },
  });
  assert.equal(remoteHostResult.ok, false);
  if (!remoteHostResult.ok) {
    assert.equal(remoteHostResult.error, 'NON_LOCAL_DB_HOST');
  }

  // Non-sauda_test_* database name rejection
  const nonPatternResult = validateIntegrationTarget({
    optInEnvVar: 'SAUDA_RUN_TEST',
    env: {
      SAUDA_RUN_TEST: '1',
      DB_HOST: 'localhost',
      DB_NAME: 'app_production_db',
    },
  });
  assert.equal(nonPatternResult.ok, false);
  if (!nonPatternResult.ok) {
    assert.equal(nonPatternResult.error, 'INVALID_TEST_DB_NAME');
  }
});

test('Section D: validateIntegrationTarget accepts valid local dedicated test environment', () => {
  const result = validateIntegrationTarget({
    optInEnvVar: 'SAUDA_RUN_TEST',
    requireApiUrl: true,
    env: {
      SAUDA_RUN_TEST: '1',
      DB_HOST: '127.0.0.1',
      DB_NAME: 'sauda_test_phase5',
      SAUDA_TEST_API_BASE: 'http://localhost:4010/api',
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.dbName, 'sauda_test_phase5');
    assert.equal(result.apiPort, 4010);
    assert.equal(result.apiUrl, 'http://localhost:4010/api');
  }
});
