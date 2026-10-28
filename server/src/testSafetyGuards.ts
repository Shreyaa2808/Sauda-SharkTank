/**
 * Shared Test Safety Guards & Environment Validation
 * Phase 5: Security, Validation and Operational Reliability
 */

import type { Pool, RowDataPacket } from 'mysql2/promise';

export const PROTECTED_DATABASE_NAMES = Object.freeze([
  'sharktank_db',
  'sharktank_db_test_full_20261023',
  'information_schema',
  'mysql',
  'performance_schema',
  'sys',
]);

export interface TargetValidationOptions {
  optInEnvVar: string;
  requireApiUrl?: boolean;
  env?: Record<string, string | undefined>;
}

export type TargetValidationResult =
  | {
      ok: true;
      dbName: string;
      dbHost: string;
      apiUrl?: string;
      apiPort?: number;
    }
  | {
      ok: false;
      error: string;
      reason: string;
    };

/**
 * Pure validation of integration test environment configuration.
 * Safe to call from pure unit tests with arbitrary environment objects.
 */
export function validateIntegrationTarget(
  options: TargetValidationOptions,
): TargetValidationResult {
  const env = options.env ?? process.env;

  // 1. Explicit Opt-In Check
  const optInValue = env[options.optInEnvVar]?.trim();
  if (optInValue !== '1') {
    return {
      ok: false,
      error: 'TEST_OPT_IN_REQUIRED',
      reason: `Integration tests require explicit opt-in via ${options.optInEnvVar}=1.`,
    };
  }

  // 2. Database Host Check (must be local)
  const dbHost = (env.DB_HOST ?? '').trim().toLowerCase();
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(dbHost);
  if (!isLocalHost) {
    return {
      ok: false,
      error: 'NON_LOCAL_DB_HOST',
      reason: `Tests may only run against a local MySQL host (localhost, 127.0.0.1, ::1). Received: '${dbHost || '(empty)'}'.`,
    };
  }

  // 3. Database Name Check (must match sauda_test_* disposable pattern)
  const dbName = (env.DB_NAME ?? '').trim();
  if (!dbName) {
    return {
      ok: false,
      error: 'MISSING_DB_NAME',
      reason: 'DB_NAME must be specified.',
    };
  }

  const isDisposablePattern = /^sauda_test_[a-z0-9_]{1,40}$/i.test(dbName);
  if (!isDisposablePattern) {
    return {
      ok: false,
      error: 'INVALID_TEST_DB_NAME',
      reason: `Target database '${dbName}' does not match the approved disposable test database pattern: /^sauda_test_[a-z0-9_]{1,40}$/i.`,
    };
  }

  // 4. Protected Database Names Check
  if (PROTECTED_DATABASE_NAMES.includes(dbName.toLowerCase())) {
    return {
      ok: false,
      error: 'PROTECTED_DATABASE_TARGETED',
      reason: `Target database '${dbName}' is protected. Integration tests are strictly forbidden from targeting application or production databases.`,
    };
  }

  // 5. API Target Check (if required)
  let validApiUrl: string | undefined;
  let parsedPort: number | undefined;

  if (options.requireApiUrl) {
    const rawApiUrl = (env.SAUDA_TEST_API_BASE ?? '').trim();
    if (!rawApiUrl) {
      return {
        ok: false,
        error: 'MISSING_TEST_API_URL',
        reason: 'SAUDA_TEST_API_BASE must be set to a local test server URL (e.g., http://localhost:4010/api).',
      };
    }

    let urlObj: URL;
    try {
      urlObj = new URL(rawApiUrl);
    } catch {
      return {
        ok: false,
        error: 'INVALID_TEST_API_URL',
        reason: `SAUDA_TEST_API_BASE '${rawApiUrl}' is not a valid absolute URL.`,
      };
    }

    if (urlObj.protocol !== 'http:') {
      return {
        ok: false,
        error: 'INSECURE_TEST_PROTOCOL',
        reason: `SAUDA_TEST_API_BASE must use http: protocol for local testing. Received: '${urlObj.protocol}'.`,
      };
    }

    if (!['localhost', '127.0.0.1'].includes(urlObj.hostname)) {
      return {
        ok: false,
        error: 'NON_LOCAL_TEST_API_HOST',
        reason: `SAUDA_TEST_API_BASE host must be localhost or 127.0.0.1. Received: '${urlObj.hostname}'.`,
      };
    }

    if (!urlObj.port) {
      return {
        ok: false,
        error: 'MISSING_TEST_API_PORT',
        reason: 'SAUDA_TEST_API_BASE must specify an explicit non-default port (e.g. 4010).',
      };
    }

    parsedPort = Number(urlObj.port);
    if (parsedPort === 4000) {
      return {
        ok: false,
        error: 'DEFAULT_PORT_FORBIDDEN',
        reason: 'SAUDA_TEST_API_BASE port 4000 is the default application port. Tests must use a dedicated non-4000 port (e.g. 4010) to avoid impacting live dev.',
      };
    }

    if (urlObj.pathname !== '/api') {
      return {
        ok: false,
        error: 'INVALID_TEST_API_PATH',
        reason: `SAUDA_TEST_API_BASE path must be exactly '/api'. Received: '${urlObj.pathname}'.`,
      };
    }

    if (urlObj.username || urlObj.password || urlObj.search || urlObj.hash) {
      return {
        ok: false,
        error: 'MALFORMED_TEST_API_URL',
        reason: 'SAUDA_TEST_API_BASE must not include credentials, query parameters, or URL fragments.',
      };
    }

    validApiUrl = rawApiUrl;
  }

  return {
    ok: true,
    dbName,
    dbHost,
    apiUrl: validApiUrl,
    apiPort: parsedPort,
  };
}

/**
 * Asserts that the integration test environment configuration is safe.
 * Terminates process or throws if safety constraints are not met.
 */
export function assertIntegrationTargetSafe(
  options: TargetValidationOptions,
): { dbName: string; dbHost: string; apiUrl?: string; apiPort?: number } {
  const result = validateIntegrationTarget(options);
  if (!result.ok) {
    const message = `[SAFETY_REFUSED] ${result.reason} (code: ${result.error})`;
    console.error(message);
    throw new Error(message);
  }
  return {
    dbName: result.dbName,
    dbHost: result.dbHost,
    apiUrl: result.apiUrl,
    apiPort: result.apiPort,
  };
}

/**
 * Verifies that the connected database name matches the expected database name.
 * Queries `SELECT DATABASE() AS currentDb` directly over the pool.
 */
export async function verifyConnectedDatabase(
  pool: Pool,
  expectedDbName: string,
): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT DATABASE() AS currentDb');
  const currentDb = rows[0]?.currentDb;
  if (!currentDb || currentDb.toLowerCase() !== expectedDbName.toLowerCase()) {
    throw new Error(
      `[DATABASE_MISMATCH] Active connection is connected to '${currentDb ?? '(none)'}', expected '${expectedDbName}'. Aborting test for safety.`,
    );
  }
}
