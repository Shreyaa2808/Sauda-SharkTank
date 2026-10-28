import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { dbPool } from './db.js';

const SESSION_COOKIE_NAME = 'sauda_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AuthenticatedUser {
  userId: number;
  fullName: string;
  email: string;
  roles: string[];
  accountStatus: string;
}

interface SessionPayload {
  userId: number;
  email: string;
  iat: number;
  exp: number;
}

export interface GoogleVerifiedProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

const MIN_SESSION_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRET_PATTERNS = [
  'your-',
  'your_',
  'change',
  'placeholder',
  'example',
  'secret-min',
  'sauda_dev_session',
  'replace',
  'password',
  'default',
];

/**
 * Returns a human-readable problem with the configured secret, or null if it is acceptable.
 * The message never contains the secret itself.
 */
function describeSecretProblem(secret: string | undefined): string | null {
  if (!secret || !secret.trim()) return 'AUTH_SESSION_SECRET is not set.';
  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    return `AUTH_SESSION_SECRET is too short (${secret.length} characters; at least ${MIN_SESSION_SECRET_LENGTH} required).`;
  }
  const lower = secret.toLowerCase();
  if (PLACEHOLDER_SECRET_PATTERNS.some((p) => lower.includes(p))) {
    return 'AUTH_SESSION_SECRET looks like a placeholder or example value.';
  }
  if (new Set(secret).size < 10) {
    return 'AUTH_SESSION_SECRET has too little variety to be a random secret.';
  }
  return null;
}

/**
 * Validates AUTH_SESSION_SECRET and throws an actionable error (without printing the secret).
 * Called at server startup so the API fails closed instead of signing with a weak/known key.
 */
export function assertSessionSecretConfigured(): void {
  const problem = describeSecretProblem(process.env.AUTH_SESSION_SECRET);
  if (problem) {
    throw new Error(
      `${problem} Set a unique random value in server/.env, e.g. ` +
        `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
    );
  }
}

/**
 * Get secret for signing session cookies. Never falls back to a built-in default.
 */
function getSessionSecret(): string {
  assertSessionSecretConfigured();
  return process.env.AUTH_SESSION_SECRET as string;
}

/**
 * Cryptographically sign a session payload using HMAC-SHA256.
 */
export function signSession(payload: SessionPayload): string {
  const secret = getSessionSecret();
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

/**
 * Verify and parse a signed session string.
 */
export function verifySession(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [data, signature] = parts;
    const secret = getSessionSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));

    // Check expiration
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Helper to parse cookies from Express request.
 */
function parseCookies(req: Request): Record<string, string> {
  const list: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });

  return list;
}

/**
 * Set signed session cookie on response.
 */
export function setSessionCookie(res: Response, payload: SessionPayload): void {
  const signed = signSession(payload);
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie(SESSION_COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
}

/**
 * Clear session cookie on response.
 */
export function clearSessionCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
  });
}

/**
 * Extract authenticated user session payload from request.
 */
export function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
}

export interface VerifyGoogleTokenOptions {
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/**
 * Verify Google ID Token server-side via Google's tokeninfo API.
 * Validates signature, expiry, expected audience (GOOGLE_CLIENT_ID), issuer, valid subject, and email verification.
 * Enforces bounded network timeout and redacts sensitive credentials from log output.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  options: VerifyGoogleTokenOptions = {},
): Promise<
  | { success: true; profile: GoogleVerifiedProfile }
  | { success: false; status: number; error: string; message: string }
> {
  const expectedClientId = process.env.GOOGLE_CLIENT_ID;

  if (!expectedClientId) {
    return {
      success: false,
      status: 503,
      error: 'GOOGLE_OAUTH_NOT_CONFIGURED',
      message: 'Google OAuth Client ID is not configured on the server environment (GOOGLE_CLIENT_ID).',
    };
  }

  if (!idToken || typeof idToken !== 'string') {
    return {
      success: false,
      status: 400,
      error: 'INVALID_CREDENTIAL',
      message: 'Missing or malformed Google ID credential.',
    };
  }

  const timeoutMs = options.timeoutMs ?? (Number(process.env.GOOGLE_OAUTH_TIMEOUT_MS) || 5000);
  const fetchFn = options.fetchFn ?? fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error('Google token verification request timed out.'));
  }, timeoutMs);

  try {
    const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const response = await fetchFn(tokenInfoUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      if (response.status >= 500) {
        return {
          success: false,
          status: 502,
          error: 'GOOGLE_OAUTH_UNAVAILABLE',
          message: 'Google authentication service is currently unreachable. Please try again later.',
        };
      }
      return {
        success: false,
        status: 401,
        error: 'TOKEN_VERIFICATION_FAILED',
        message: 'Google rejected the supplied ID credential (invalid signature, expired, or revoked).',
      };
    }

    const claims = (await response.json()) as Record<string, unknown>;

    // 1. Audience verification (must match GOOGLE_CLIENT_ID)
    if (claims.aud !== expectedClientId) {
      return {
        success: false,
        status: 401,
        error: 'AUDIENCE_MISMATCH',
        message: 'Google ID token audience does not match the configured GOOGLE_CLIENT_ID.',
      };
    }

    // 2. Issuer verification
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (typeof claims.iss !== 'string' || !validIssuers.includes(claims.iss)) {
      return {
        success: false,
        status: 401,
        error: 'INVALID_ISSUER',
        message: 'Google ID token issuer is invalid.',
      };
    }

    // 3. Expiry verification
    const exp = Number(claims.exp);
    if (!exp || exp < Math.floor(Date.now() / 1000)) {
      return {
        success: false,
        status: 401,
        error: 'TOKEN_EXPIRED',
        message: 'Google ID token has expired.',
      };
    }

    // 4. Subject validation
    const sub = typeof claims.sub === 'string' ? claims.sub.trim() : '';
    if (!sub) {
      return {
        success: false,
        status: 401,
        error: 'INVALID_SUBJECT',
        message: 'Google ID token does not contain a valid subject identifier.',
      };
    }

    // 5. Email verification status
    const emailVerified = claims.email_verified === 'true' || claims.email_verified === true;
    if (!emailVerified) {
      return {
        success: false,
        status: 403,
        error: 'EMAIL_NOT_VERIFIED',
        message: 'Google email address is not verified by Google.',
      };
    }

    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
    if (!email) {
      return {
        success: false,
        status: 400,
        error: 'MISSING_EMAIL',
        message: 'Google ID token does not contain an email address.',
      };
    }

    const name = typeof claims.name === 'string' ? claims.name.trim() : undefined;
    const picture = typeof claims.picture === 'string' ? claims.picture.trim() : undefined;

    return {
      success: true,
      profile: {
        sub,
        email,
        name,
        picture,
      },
    };
  } catch (err: any) {
    clearTimeout(timer);
    const isTimeout =
      err?.name === 'TimeoutError' ||
      err?.name === 'AbortError' ||
      err?.code === 'ABORT_ERR' ||
      controller.signal.aborted;

    if (isTimeout) {
      return {
        success: false,
        status: 504,
        error: 'GOOGLE_OAUTH_TIMEOUT',
        message: 'Google token verification service timed out. Please try again.',
      };
    }

    // Never log raw tokens, payload details, or secrets
    console.error('[Auth] Error contacting Google token verification service:', err?.message || 'Network error');
    return {
      success: false,
      status: 502,
      error: 'VERIFICATION_SERVICE_UNAVAILABLE',
      message: 'Unable to reach Google token verification service. Please try again.',
    };
  }
}

/**
 * Look up existing user by Google subject, or provision a new user with default VIEWER role.
 * Enforces rule: never auto-link accounts with matching email; require explicit linking.
 */
export async function authenticateOrProvisionGoogleUser(
  profile: GoogleVerifiedProfile,
): Promise<
  | { success: true; user: AuthenticatedUser }
  | { success: false; status: number; error: string; message: string }
> {
  // 1. Look up account by Google subject
  const [existingSubjectRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT u.user_id AS userId,
            u.full_name AS fullName,
            u.email,
            u.google_subject AS googleSubject,
            u.account_status AS accountStatus,
            GROUP_CONCAT(r.role_name) AS roles
     FROM app_user u
     LEFT JOIN user_role ur ON ur.user_id = u.user_id
     LEFT JOIN app_role r ON r.role_id = ur.role_id
     WHERE u.google_subject = ?
     GROUP BY u.user_id`,
    [profile.sub],
  );

  if (existingSubjectRows.length > 0) {
    const row = existingSubjectRows[0];
    if (row.accountStatus !== 'ACTIVE') {
      return {
        success: false,
        status: 403,
        error: 'ACCOUNT_DEACTIVATED',
        message: 'Your Sauda account is inactive or has been suspended. Please contact an administrator.',
      };
    }

    const rolesList = row.roles ? (row.roles as string).split(',') : ['VIEWER'];

    return {
      success: true,
      user: {
        userId: row.userId,
        fullName: row.fullName || profile.name || row.email.split('@')[0],
        email: row.email,
        roles: rolesList,
        accountStatus: row.accountStatus,
      },
    };
  }

  // 2. Check if verified email belongs to an existing account without Google subject
  const [existingEmailRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT user_id AS userId, email, google_subject AS googleSubject, account_status AS accountStatus
     FROM app_user
     WHERE email = ?`,
    [profile.email],
  );

  if (existingEmailRows.length > 0) {
    // DO NOT auto-link accounts solely because their email addresses match!
    return {
      success: false,
      status: 409,
      error: 'ACCOUNT_LINKING_REQUIRED',
      message:
        'An existing Sauda account is already registered with this email address. ' +
        'For security, automatic account linking is disabled. Please contact the administrator or support team at support@sauda.internal to securely link your Google account.',
    };
  }

  // 3. New account registration: Create user with Google identity and assign VIEWER role in transaction
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    // Look up role_id for VIEWER by name first; there is no numeric fallback.
    const [viewerRoleRows] = await conn.execute<RowDataPacket[]>(
      `SELECT role_id AS roleId FROM app_role WHERE role_name = 'VIEWER'`,
    );
    const viewerRoleId = Number(viewerRoleRows[0]?.roleId);
    if (!Number.isInteger(viewerRoleId) || viewerRoleId < 1) {
      await conn.rollback();
      console.error('Account provisioning aborted: app_role has no valid VIEWER role. Seed the role table.');
      return {
        success: false,
        status: 500,
        error: 'SERVER_CONFIGURATION_ERROR',
        message: 'Account creation is temporarily unavailable due to a server configuration problem.',
      };
    }

    const fullName = profile.name || profile.email.split('@')[0];

    const [insertResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO app_user (full_name, email, google_subject, password_hash, account_status)
       VALUES (?, ?, ?, NULL, 'ACTIVE')`,
      [fullName, profile.email, profile.sub],
    );

    const newUserId = insertResult.insertId;

    // Assign default VIEWER role (normal users never assign themselves ADMIN, FOUNDER, or INVESTOR during Google auth)
    await conn.execute(
      `INSERT INTO user_role (user_id, role_id) VALUES (?, ?)`,
      [newUserId, viewerRoleId],
    );

    await conn.commit();

    return {
      success: true,
      user: {
        userId: newUserId,
        fullName,
        email: profile.email,
        roles: ['VIEWER'],
        accountStatus: 'ACTIVE',
      },
    };
  } catch (err) {
    await conn.rollback();
    console.error('Failed to provision new Google account:', err);
    return {
      success: false,
      status: 500,
      error: 'ACCOUNT_PROVISIONING_FAILED',
      message: 'Failed to create account. Please try again.',
    };
  } finally {
    conn.release();
  }
}

/**
 * Fetch authenticated user details from database by session userId.
 */
export async function getAuthenticatedUser(userId: number): Promise<AuthenticatedUser | null> {
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT u.user_id AS userId,
            u.full_name AS fullName,
            u.email,
            u.account_status AS accountStatus,
            GROUP_CONCAT(r.role_name) AS roles
     FROM app_user u
     LEFT JOIN user_role ur ON ur.user_id = u.user_id
     LEFT JOIN app_role r ON r.role_id = ur.role_id
     WHERE u.user_id = ?
     GROUP BY u.user_id`,
    [userId],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  if (row.accountStatus !== 'ACTIVE') return null;

  const rolesList = row.roles ? (row.roles as string).split(',') : ['VIEWER'];

  return {
    userId: row.userId,
    fullName: row.fullName || row.email.split('@')[0],
    email: row.email,
    roles: rolesList,
    accountStatus: row.accountStatus,
  };
}

export interface UserProfile {
  userId: number;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  accountStatus: string;
  createdAt: string | null;
  roles: string[];
  googleSubjectMasked: string | null;
}

function maskSubject(sub: string | null): string | null {
  if (!sub) return null;
  if (sub.length <= 8) return '••••' + sub.slice(-4);
  return sub.slice(0, 4) + '••••••••••••' + sub.slice(-4);
}

/**
 * Fetch complete user profile for authenticated account.
 */
export async function getUserProfile(userId: number): Promise<UserProfile | null> {
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT u.user_id AS userId,
            u.full_name AS fullName,
            u.email,
            u.phone_number AS phoneNumber,
            u.account_status AS accountStatus,
            u.created_at AS createdAt,
            u.google_subject AS googleSubject,
            GROUP_CONCAT(r.role_name) AS roles
     FROM app_user u
     LEFT JOIN user_role ur ON ur.user_id = u.user_id
     LEFT JOIN app_role r ON r.role_id = ur.role_id
     WHERE u.user_id = ?
     GROUP BY u.user_id`,
    [userId],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  if (row.accountStatus !== 'ACTIVE') return null;

  const rolesList = row.roles ? (row.roles as string).split(',') : ['VIEWER'];

  return {
    userId: row.userId,
    fullName: row.fullName || row.email.split('@')[0],
    email: row.email,
    phoneNumber: row.phoneNumber || null,
    accountStatus: row.accountStatus,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    roles: rolesList,
    googleSubjectMasked: maskSubject(row.googleSubject || null),
  };
}

/**
 * Update editable profile attributes (fullName, phoneNumber) for the authenticated user.
 * Disallows updating email, roles, status, google_subject, or created_at.
 */
export async function updateUserProfile(
  userId: number,
  data: { fullName: string; phoneNumber?: string | null },
): Promise<{ success: true; user: UserProfile } | { success: false; status: number; error: string; message: string }> {
  const trimmedName = (data.fullName || '').trim();
  if (!trimmedName || trimmedName.length > 100) {
    return {
      success: false,
      status: 400,
      error: 'INVALID_NAME',
      message: 'Full name is required and must not exceed 100 characters.',
    };
  }

  let cleanPhone: string | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(data, 'phoneNumber')) {
    if (data.phoneNumber === null) {
      cleanPhone = null;
    } else if (typeof data.phoneNumber === 'string') {
      const trimmedPhone = data.phoneNumber.trim();
      if (trimmedPhone.length > 0) {
        const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{5,20}$/;
        if (!phoneRegex.test(trimmedPhone) || trimmedPhone.length > 25) {
          return {
            success: false,
            status: 400,
            error: 'INVALID_PHONE',
            message: 'Please provide a valid phone number format (e.g., +91 98765 43210).',
          };
        }
        cleanPhone = trimmedPhone;
      } else {
        cleanPhone = null;
      }
    } else {
      return {
        success: false,
        status: 400,
        error: 'INVALID_PHONE',
        message: 'phoneNumber must be a valid phone string or null.',
      };
    }
  }

  const updatePhone = cleanPhone !== undefined;
  const [result] = updatePhone
    ? await dbPool.execute<ResultSetHeader>(
        `UPDATE app_user SET full_name = ?, phone_number = ? WHERE user_id = ? AND account_status = 'ACTIVE'`,
        [trimmedName, cleanPhone ?? null, userId],
      )
    : await dbPool.execute<ResultSetHeader>(
        `UPDATE app_user SET full_name = ? WHERE user_id = ? AND account_status = 'ACTIVE'`,
        [trimmedName, userId],
      );

  if (result.affectedRows === 0) {
    return {
      success: false,
      status: 404,
      error: 'USER_NOT_FOUND',
      message: 'User account not found or inactive.',
    };
  }

  const updated = await getUserProfile(userId);
  if (!updated) {
    return {
      success: false,
      status: 500,
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve updated profile.',
    };
  }

  return {
    success: true,
    user: updated,
  };
}

/**
 * Self-service activation of workspace roles (FOUNDER or INVESTOR).
 * Strictly forbids self-assignment of ADMIN role (returns 403).
 * Idempotently assigns the role and links corresponding profile in founder/investor tables.
 */
export async function activateUserRole(
  userId: number,
  roleName: string,
): Promise<{ success: true; roles: string[] } | { success: false; status: number; error: string; message: string }> {
  const normalizedRole = (roleName || '').trim().toUpperCase();

  if (normalizedRole === 'ADMIN') {
    return {
      success: false,
      status: 403,
      error: 'ROLE_ACTIVATION_FORBIDDEN',
      message: 'Self-assignment of the ADMIN role is strictly forbidden.',
    };
  }

  if (normalizedRole !== 'FOUNDER' && normalizedRole !== 'INVESTOR') {
    return {
      success: false,
      status: 400,
      error: 'INVALID_ROLE',
      message: "Only 'FOUNDER' and 'INVESTOR' workspace roles can be activated through self-service.",
    };
  }

  // Retrieve user record
  const [userRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT user_id AS userId, full_name AS fullName, email, account_status AS accountStatus FROM app_user WHERE user_id = ?`,
    [userId],
  );

  if (userRows.length === 0 || userRows[0].accountStatus !== 'ACTIVE') {
    return {
      success: false,
      status: 404,
      error: 'USER_NOT_FOUND',
      message: 'Active user account not found.',
    };
  }

  const user = userRows[0];
  const nameParts = (user.fullName || 'User').trim().split(/\s+/);
  const firstName = nameParts[0] || 'User';
  const lastName = nameParts.slice(1).join(' ') || (normalizedRole === 'FOUNDER' ? 'Founder' : 'Investor');

  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    // Look up role_id from app_role
    const [roleRows] = await conn.execute<RowDataPacket[]>(
      `SELECT role_id FROM app_role WHERE role_name = ?`,
      [normalizedRole],
    );

    if (roleRows.length === 0) {
      await conn.rollback();
      return {
        success: false,
        status: 500,
        error: 'ROLE_NOT_CONFIGURED',
        message: `Role ${normalizedRole} is not configured in the database.`,
      };
    }

    const roleId = roleRows[0].role_id;

    // Idempotent assignment to user_role
    await conn.execute(
      `INSERT IGNORE INTO user_role (user_id, role_id) VALUES (?, ?)`,
      [userId, roleId],
    );

    // Ensure linked profile exists to satisfy connection_request foreign keys
    if (normalizedRole === 'FOUNDER') {
      await conn.execute(
        `INSERT INTO founder (user_id, first_name, last_name, email)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE first_name = VALUES(first_name)`,
        [userId, firstName, lastName, user.email],
      );
    } else if (normalizedRole === 'INVESTOR') {
      await conn.execute(
        `INSERT INTO investor (user_id, first_name, last_name, display_name)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
        [userId, firstName, lastName, user.fullName],
      );
    }

    await conn.commit();

    // Query updated roles
    const [rolesResult] = await dbPool.execute<RowDataPacket[]>(
      `SELECT r.role_name
       FROM user_role ur
       INNER JOIN app_role r ON r.role_id = ur.role_id
       WHERE ur.user_id = ?
       ORDER BY r.role_id`,
      [userId],
    );

    const updatedRoles = rolesResult.map((r) => r.role_name as string);

    return {
      success: true,
      roles: updatedRoles,
    };
  } catch (err) {
    await conn.rollback();
    console.error('Failed to activate user role:', err);
    return {
      success: false,
      status: 500,
      error: 'SERVER_ERROR',
      message: 'Failed to activate workspace role.',
    };
  } finally {
    conn.release();
  }
}

