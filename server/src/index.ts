
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { RowDataPacket } from 'mysql2';
import { dbPool } from './db.js';
import {
  verifyGoogleIdToken,
  authenticateOrProvisionGoogleUser,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
  getAuthenticatedUser,
  getUserProfile,
  updateUserProfile,
  activateUserRole,
  assertSessionSecretConfigured,
} from './auth.js';
import {
  getMetadata,
  getInvestorDashboard,
  getInvestorPitches,
  toggleWatchlist,
  createConnectionRequest,
  getUserConnections,
  respondToConnectionRequest,
  withdrawConnectionRequest,
  endConnection,
  getConversationMessages,
  sendChatMessage,
} from './workspaces.js';
import {
  getFounderDashboard,
  getFounderPitchById,
  createFounderPitch,
  updateFounderPitch,
  archiveFounderPitch,
} from './founder.js';
import {
  AdminReviewError,
  decideAdminReview,
  evaluateRoleAccess,
  getAdminReviewDetail,
  getAdminReviewQueue,
  getFounderPitchReviewHistory,
  parseReviewDecisionInput,
} from './adminReview.js';

import {
  getFounderRoleProfile,
  getInvestorRoleProfile,
  updateFounderRoleProfile,
  updateInvestorRoleProfile,
} from './roleProfiles.js';
import {
  HistoricalServiceError,
  assignHistoricalEpisodeSharkSeat,
  removeHistoricalEpisodeSharkSeat,
  compareStartups,
  createHistoricalEpisode,
  createHistoricalOffer,
  createHistoricalPitch,
  createHistoricalSeason,
  createHistoricalShark,
  deleteHistoricalEpisode,
  deleteHistoricalOffer,
  deleteHistoricalPitch,
  deleteHistoricalSeason,
  deleteHistoricalShark,
  deleteHistoricalDeal,
  getHistoricalEpisodeDetail,
  getHistoricalImportReport,
  getHistoricalStatistics,
  importHistoricalPitchesCsv,
  listHistoricalImportReports,
  listHistoricalEpisodes,
  listHistoricalSeasons,
  listHistoricalSharks,
  searchHistoricalPitches,
  updateHistoricalEpisode,
  updateHistoricalOffer,
  updateHistoricalPitch,
  updateHistoricalSeason,
  updateHistoricalShark,
  upsertHistoricalDeal,
} from './historical.js';

// Fail closed: refuse to boot without a strong, non-placeholder AUTH_SESSION_SECRET.
try {
  assertSessionSecretConfigured();
} catch (err) {
  console.error(`[FATAL] ${(err as Error).message}`);
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
// Bound request bodies; oversized payloads are rejected with 413 (see error handler below).
app.use(express.json({ limit: '100kb' }));

// ============================================================================
// HEALTH ENDPOINTS
// ============================================================================

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'sharktankdbms-api',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health/db', async (_req, res) => {
  try {
    await dbPool.query('SELECT 1 AS ok');

    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      status: 'error',
      database: 'disconnected'
    });
  }
});

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/google
 * Receives Google ID credential token from frontend, verifies signature/claims server-side,
 * provisions or authenticates user with default VIEWER role, and issues signed HttpOnly session cookie.
 */
app.post('/api/auth/google', async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({
      error: 'INVALID_BODY',
      message: 'A JSON object is required.',
    });
    return;
  }
  const { credential } = req.body;

  if (!credential || typeof credential !== 'string') {
    res.status(400).json({
      error: 'MISSING_CREDENTIAL',
      message: 'Google credential token is required.',
    });
    return;
  }

  // 1. Verify Google token server-side against Google Identity Services
  const verifyRes = await verifyGoogleIdToken(credential);
  if (!verifyRes.success) {
    res.status(verifyRes.status).json({
      error: verifyRes.error,
      message: verifyRes.message,
    });
    return;
  }

  // 2. Look up or provision user with default VIEWER role (in transaction, no email auto-linking)
  const authRes = await authenticateOrProvisionGoogleUser(verifyRes.profile);
  if (!authRes.success) {
    res.status(authRes.status).json({
      error: authRes.error,
      message: authRes.message,
    });
    return;
  }

  // 3. Issue signed HttpOnly session cookie
  const now = Math.floor(Date.now() / 1000);
  const sessionPayload = {
    userId: authRes.user.userId,
    email: authRes.user.email,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 days
  };

  setSessionCookie(res, sessionPayload);

  res.status(200).json({
    ok: true,
    user: {
      userId: authRes.user.userId,
      fullName: authRes.user.fullName,
      email: authRes.user.email,
      roles: authRes.user.roles,
    },
  });
});

/**
 * GET /api/auth/me
 * Validates session cookie, queries authoritative user and roles from database.
 */
app.get('/api/auth/me', async (req, res) => {
  const session = getSessionFromRequest(req);

  if (!session) {
    res.status(200).json({
      authenticated: false,
      user: null,
    });
    return;
  }

  try {
    const user = await getAuthenticatedUser(session.userId);

    if (!user) {
      clearSessionCookie(res);
      res.status(200).json({
        authenticated: false,
        user: null,
      });
      return;
    }

    res.status(200).json({
      authenticated: true,
      user: {
        userId: user.userId,
        fullName: user.fullName,
        email: user.email,
        roles: user.roles,
      },
    });
  } catch (err) {
    console.error('Failed to load session user:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Unable to verify session.',
    });
  }
});

/**
 * POST /api/auth/logout
 * Clears signed session cookie.
 */
app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(200).json({
    ok: true,
    message: 'Logged out successfully.',
  });
});

import {
  ValidationError,
  parsePositiveIntegerId,
  parsePagination,
  validateJsonObject,
} from './validation.js';

// Common error mapping for schema-backed historical data services.
function sendHistoricalError(res: express.Response, error: unknown, fallback: string) {
  if (error instanceof ValidationError) {
    res.status(error.status).json({ error: error.code, message: error.message });
    return;
  }
  if (error instanceof HistoricalServiceError) {
    res.status(error.status).json({ error: error.code, message: error.message });
    return;
  }
  console.error(fallback, error);
  res.status(500).json({ error: 'SERVER_ERROR', message: fallback });
}

// ============================================================================
// USER PROFILE & ACCOUNT ENDPOINTS
// ============================================================================

/**
 * GET /api/user/profile
 * Retrieves complete profile of the authenticated user.
 * Disallows unauthenticated access (returns 401).
 */
app.get('/api/user/profile', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'You must be signed in to access profile details.',
    });
    return;
  }

  try {
    const profile = await getUserProfile(session.userId);
    if (!profile) {
      clearSessionCookie(res);
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Session invalid or account inactive.',
      });
      return;
    }

    res.status(200).json({
      ok: true,
      user: profile,
    });
  } catch (err) {
    console.error('Failed to get user profile:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve user profile.',
    });
  }
});

/**
 * PUT /api/user/profile
 * Updates allowed profile fields (fullName, phoneNumber) for the authenticated user.
 * Protected by session authorization; ignores any client-supplied userId.
 */
app.put('/api/user/profile', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'You must be signed in to update your profile.',
    });
    return;
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'INVALID_BODY', message: 'A JSON object is required.' });
    return;
  }
  const { fullName, phoneNumber } = req.body;
  if (typeof fullName !== 'string') {
    res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'fullName is required and must be a string.',
    });
    return;
  }

  if (phoneNumber !== undefined && phoneNumber !== null && typeof phoneNumber !== 'string') {
    res.status(400).json({ error: 'INVALID_PHONE', message: 'phoneNumber must be a string or null.' });
    return;
  }

  try {
    const result = await updateUserProfile(session.userId, {
      fullName,
      ...(phoneNumber !== undefined ? { phoneNumber } : {}),
    });

    if (!result.success) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      user: result.user,
      message: 'Profile updated successfully.',
    });
  } catch (err) {
    console.error('Failed to update user profile:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to update profile.',
    });
  }
});

/**
 * Helper to authenticate request and verify role authorization.
 */
async function requireAuthAndRole(
  req: express.Request,
  res: express.Response,
  allowedRoles?: string[],
) {
  const session = getSessionFromRequest(req);
  if (!session) {
    // Keep the status decision shared with the role tests; no unauthenticated request is authorized.
    const access = evaluateRoleAccess(false, [], allowedRoles);
    res.status(access.status ?? 401).json({
      error: access.error ?? 'UNAUTHORIZED',
      message: 'Authentication session required.',
    });
    return null;
  }

  const user = await getAuthenticatedUser(session.userId);
  if (!user) {
    clearSessionCookie(res);
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid session or account inactive.',
    });
    return null;
  }

  const access = evaluateRoleAccess(true, user.roles, allowedRoles);
  if (!access.allowed) {
    res.status(access.status ?? 403).json({
      error: access.error ?? 'FORBIDDEN',
      message: `This action requires one of the following workspace roles: ${(allowedRoles ?? []).join(', ')}.`,
    });
    return null;
  }

  return user;
}

// ============================================================================
// ROLE-SPECIFIC PROFILE ENDPOINTS
// ============================================================================

app.get('/api/founder/profile', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['FOUNDER']);
  if (!user) return;
  try {
    const result = await getFounderRoleProfile(user.userId);
    if (!result.success) { res.status(result.status).json({ error: result.error, message: result.message }); return; }
    res.status(200).json({ ok: true, profile: result.data });
  } catch (error) { sendHistoricalError(res, error, 'Failed to load Founder profile.'); }
});

app.put('/api/founder/profile', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['FOUNDER']);
  if (!user) return;
  try {
    const result = await updateFounderRoleProfile(user.userId, req.body);
    if (!result.success) { res.status(result.status).json({ error: result.error, message: result.message }); return; }
    res.status(200).json({ ok: true, profile: result.data, message: 'Founder profile updated.' });
  } catch (error) { sendHistoricalError(res, error, 'Failed to update Founder profile.'); }
});

app.get('/api/investor/profile', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['INVESTOR']);
  if (!user) return;
  try {
    const result = await getInvestorRoleProfile(user.userId);
    if (!result.success) { res.status(result.status).json({ error: result.error, message: result.message }); return; }
    res.status(200).json({ ok: true, profile: result.data });
  } catch (error) { sendHistoricalError(res, error, 'Failed to load Investor profile.'); }
});

app.put('/api/investor/profile', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['INVESTOR']);
  if (!user) return;
  try {
    const result = await updateInvestorRoleProfile(user.userId, req.body);
    if (!result.success) { res.status(result.status).json({ error: result.error, message: result.message }); return; }
    res.status(200).json({ ok: true, profile: result.data, message: 'Investor profile updated.' });
  } catch (error) { sendHistoricalError(res, error, 'Failed to update Investor profile.'); }
});

// ============================================================================
// ROLE ONBOARDING & ACTIVATION ENDPOINTS
// ============================================================================

/**
 * POST /api/user/roles/activate
 * Self-service activation of workspace roles (FOUNDER or INVESTOR).
 * Strictly forbids self-assignment of ADMIN role (returns 403).
 */
app.post('/api/user/roles/activate', async (req, res) => {
  const user = await requireAuthAndRole(req, res);
  if (!user) return;

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'INVALID_BODY', message: 'A JSON object is required.' });
    return;
  }

  const { role } = req.body;
  if (!role || typeof role !== 'string') {
    res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Role name is required.',
    });
    return;
  }

  try {
    const result = await activateUserRole(user.userId, role);
    if (!result.success) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      roles: result.roles,
      message: `Successfully activated ${role.toUpperCase()} workspace.`,
    });
  } catch (err) {
    console.error('Role activation error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to activate workspace role.',
    });
  }
});

// ============================================================================
// ADMIN PITCH REVIEW ENDPOINTS
// ============================================================================

function sendReviewError(res: express.Response, error: unknown, fallbackMessage: string) {
  if (error instanceof ValidationError) {
    res.status(error.status).json({ error: error.code, message: error.message });
    return;
  }
  if (error instanceof AdminReviewError) {
    res.status(error.status).json({ error: error.code, message: error.message });
    return;
  }
  console.error(fallbackMessage, error);
  res.status(500).json({
    error: 'SERVER_ERROR',
    message: fallbackMessage,
  });
}

/** GET /api/admin/reviews — eligible submitted PLATFORM pitches only with optional bounded pagination. */
app.get('/api/admin/reviews', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']);
  if (!user) return;
  try {
    const pagination =
      req.query.limit !== undefined || req.query.offset !== undefined
        ? parsePagination(req.query as Record<string, unknown>, { defaultLimit: 50, maxLimit: 100 })
        : undefined;
    const data = await getAdminReviewQueue(dbPool, pagination);
    res.status(200).json({ ok: true, count: data.length, data });
  } catch (error) {
    sendReviewError(res, error, 'Failed to load the Admin review queue.');
  }
});

/** GET /api/admin/reviews/:pitchId — details and append-only review history for a PLATFORM pitch. */
app.get('/api/admin/reviews/:pitchId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']);
  if (!user) return;
  const pitchId = Number(req.params.pitchId);
  if (!Number.isSafeInteger(pitchId) || pitchId < 1) {
    res.status(400).json({ error: 'INVALID_PITCH_ID', message: 'Valid pitch ID required.' });
    return;
  }
  try {
    const detail = await getAdminReviewDetail(dbPool, pitchId);
    res.status(200).json({ ok: true, ...detail });
  } catch (error) {
    sendReviewError(res, error, 'Failed to load pitch review details.');
  }
});

/** POST /api/admin/reviews/:pitchId/decision — serialize decisions under a row lock. */
app.post('/api/admin/reviews/:pitchId/decision', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']);
  if (!user) return;
  const pitchId = Number(req.params.pitchId);
  if (!Number.isSafeInteger(pitchId) || pitchId < 1) {
    res.status(400).json({ error: 'INVALID_PITCH_ID', message: 'Valid pitch ID required.' });
    return;
  }
  const parsed = parseReviewDecisionInput(req.body);
  if (!parsed.ok) {
    res.status(parsed.status).json({ error: parsed.error, message: parsed.message });
    return;
  }
  try {
    const result = await decideAdminReview(dbPool, pitchId, user.userId, parsed.value);
    res.status(200).json({
      ok: true,
      ...result,
      message: result.pitchStatus === 'PUBLISHED' ? 'Pitch published to the registry.' : 'Pitch rejected and feedback recorded.',
    });
  } catch (error) {
    sendReviewError(res, error, 'Failed to save the pitch review decision. Ensure the approved review migration is applied.');
  }
});

/** GET /api/founder/pitches/:pitchId/reviews — owner-only feedback/history. */
app.get('/api/founder/pitches/:pitchId/reviews', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['FOUNDER']);
  if (!user) return;
  const pitchId = Number(req.params.pitchId);
  if (!Number.isSafeInteger(pitchId) || pitchId < 1) {
    res.status(400).json({ error: 'INVALID_PITCH_ID', message: 'Valid pitch ID required.' });
    return;
  }
  try {
    const history = await getFounderPitchReviewHistory(dbPool, user.userId, pitchId);
    res.status(200).json({ ok: true, history });
  } catch (error) {
    sendReviewError(res, error, 'Failed to load pitch review feedback. Ensure the approved review migration is applied.');
  }
});

// ============================================================================
// METADATA ENDPOINTS
// ============================================================================

app.get('/api/meta/categories', async (_req, res) => {
  try {
    const data = await getMetadata();
    res.status(200).json({
      ok: true,
      ...data,
    });
  } catch (err) {
    console.error('Failed to get metadata categories:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to fetch categories.',
    });
  }
});

// ============================================================================
// FOUNDER WORKSPACE ENDPOINTS
// ============================================================================

/**
 * GET /api/founder/pitches
 * Returns founder's own PLATFORM pitches and aggregate status counts.
 * Requires FOUNDER role.
 */
app.get('/api/founder/pitches', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['FOUNDER']);
  if (!user) return;

  try {
    const data = await getFounderDashboard(user.userId);
    res.status(200).json({
      ok: true,
      ...data,
    });
  } catch (err) {
    console.error('Founder dashboard error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to load founder dashboard.',
    });
  }
});

/**
 * POST /api/founder/pitches
 * Creates a new PLATFORM pitch owned by the authenticated founder.
 * Requires FOUNDER role.
 */
app.post('/api/founder/pitches', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['FOUNDER']);
  if (!user) return;

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'INVALID_BODY', message: 'A JSON pitch object is required.' });
    return;
  }

  try {
    const result = await createFounderPitch(user.userId, req.body);
    if (!result.success) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
        ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
      });
      return;
    }

    res.status(201).json({
      ok: true,
      pitchId: result.pitchId,
      pitch: result.pitch,
      message: 'Pitch created successfully.',
    });
  } catch (err) {
    console.error('Create pitch error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to create pitch.',
    });
  }
});

/**
 * PUT /api/founder/pitches/:pitchId
 * Updates founder's own PLATFORM pitch. Never allows modifying SHOW pitches or other founders' pitches.
 * Requires FOUNDER role.
 */
app.put('/api/founder/pitches/:pitchId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['FOUNDER']);
  if (!user) return;

  const pitchId = Number(req.params.pitchId);
  if (!Number.isSafeInteger(pitchId) || pitchId < 1) {
    res.status(400).json({
      error: 'INVALID_PITCH_ID',
      message: 'Valid pitch ID required.',
    });
    return;
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'INVALID_BODY', message: 'A JSON pitch object is required.' });
    return;
  }

  try {
    const result = await updateFounderPitch(user.userId, pitchId, req.body);
    if (!result.success) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
        ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
      });
      return;
    }

    res.status(200).json({
      ok: true,
      pitch: result.pitch,
      message: 'Pitch updated successfully.',
    });
  } catch (err) {
    console.error('Update pitch error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to update pitch.',
    });
  }
});

/**
 * GET /api/founder/pitches/:pitchId
 * Returns one of the founder's own PLATFORM pitches (used to load the edit form).
 * Requires FOUNDER role; owner only.
 */
app.get('/api/founder/pitches/:pitchId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['FOUNDER']);
  if (!user) return;

  const pitchId = Number(req.params.pitchId);
  if (!Number.isSafeInteger(pitchId) || pitchId < 1) {
    res.status(400).json({ error: 'INVALID_PITCH_ID', message: 'Valid pitch ID required.' });
    return;
  }

  try {
    const result = await getFounderPitchById(user.userId, pitchId);
    if (!result.success) {
      res.status(result.status).json({ error: result.error, message: result.message });
      return;
    }
    res.status(200).json({ ok: true, pitch: result.pitch });
  } catch (err) {
    console.error('Get founder pitch error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load pitch.' });
  }
});

/**
 * PUT /api/admin/platform-pitches/:pitchId
 * Admin correction of a PLATFORM listing while preserving its current status.
 * The route deliberately rejects pitchStatus changes; review and archive use separate actions.
 */
app.put('/api/admin/platform-pitches/:pitchId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']);
  if (!user) return;
  const pitchId = Number(req.params.pitchId);
  if (!Number.isSafeInteger(pitchId) || pitchId < 1) {
    res.status(400).json({ error: 'INVALID_PITCH_ID', message: 'Valid pitch ID required.' }); return;
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'INVALID_BODY', message: 'A JSON pitch object is required.' }); return;
  }
  if ('pitchStatus' in req.body) {
    res.status(400).json({ error: 'ADMIN_STATUS_CHANGE_FORBIDDEN', message: 'Use the review-decision or archive endpoint to change a listing status.' }); return;
  }
  try {
    const result = await updateFounderPitch(user.userId, pitchId, req.body, true);
    if (!result.success) { res.status(result.status).json({ error: result.error, message: result.message, fieldErrors: result.fieldErrors }); return; }
    res.status(200).json({ ok: true, pitch: result.pitch, message: 'Platform listing corrected by an administrator.' });
  } catch (error) {
    console.error('Admin platform listing correction failed:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to correct platform listing.' });
  }
});

/**
 * POST /api/founder/pitches/:pitchId/archive
 * Owner-only soft removal. Sets pitch_status = 'ARCHIVED', withdraws pending requests,
 * ends accepted connections and makes their conversations read-only. Nothing is deleted.
 * Requires FOUNDER role.
 */
/**
 * POST /api/admin/platform-pitches/:pitchId/archive
 * Admin moderation soft-removes a PLATFORM listing and applies the same request/message
 * lifecycle effects as owner archive. Historical SHOW records remain immutable.
 */
app.post('/api/admin/platform-pitches/:pitchId/archive', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']);
  if (!user) return;
  const pitchId = Number(req.params.pitchId);
  if (!Number.isSafeInteger(pitchId) || pitchId < 1) {
    res.status(400).json({ error: 'INVALID_PITCH_ID', message: 'Valid pitch ID required.' });
    return;
  }
  try {
    const result = await archiveFounderPitch(user.userId, pitchId, true);
    if (!result.success) {
      res.status(result.status).json({ error: result.error, message: result.message });
      return;
    }
    res.status(200).json({ ok: true, pitch: result.pitch, summary: result.summary, message: 'Platform listing archived by an administrator.' });
  } catch (err) {
    console.error('Admin pitch archive error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to archive platform listing.' });
  }
});

app.post('/api/founder/pitches/:pitchId/archive', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['FOUNDER']);
  if (!user) return;

  const pitchId = Number(req.params.pitchId);
  if (!Number.isSafeInteger(pitchId) || pitchId < 1) {
    res.status(400).json({ error: 'INVALID_PITCH_ID', message: 'Valid pitch ID required.' });
    return;
  }

  try {
    const result = await archiveFounderPitch(user.userId, pitchId);
    if (!result.success) {
      res.status(result.status).json({ error: result.error, message: result.message });
      return;
    }
    res.status(200).json({
      ok: true,
      pitch: result.pitch,
      summary: result.summary,
      message: 'Pitch archived.',
    });
  } catch (err) {
    console.error('Archive pitch error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to archive pitch.' });
  }
});

// ============================================================================
// INVESTOR WORKSPACE ENDPOINTS
// ============================================================================

/**
 * GET /api/investor/dashboard
 * Returns investor deal room metrics derived from database.
 * Requires INVESTOR role.
 */
app.get('/api/investor/dashboard', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['INVESTOR']);
  if (!user) return;

  try {
    const metrics = await getInvestorDashboard(user.userId);
    res.status(200).json({
      ok: true,
      metrics,
    });
  } catch (err) {
    console.error('Investor dashboard error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to load investor metrics.',
    });
  }
});

/**
 * GET /api/investor/pitches
 * Returns published deals with connection status and watchlist indicators.
 * Requires INVESTOR role. Never returns unpublished drafts.
 */
app.get('/api/investor/pitches', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['INVESTOR']);
  if (!user) return;

  try {
    const pitches = await getInvestorPitches(user.userId, {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      industry: typeof req.query.industry === 'string' ? req.query.industry : undefined,
      stage: typeof req.query.stage === 'string' ? req.query.stage : undefined,
      source: req.query.source === 'SHOW' || req.query.source === 'PLATFORM' ? req.query.source : 'ALL',
      sortBy:
        req.query.sortBy === 'ask_asc' || req.query.sortBy === 'ask_desc' || req.query.sortBy === 'brand_name'
          ? req.query.sortBy
          : 'latest',
      savedOnly: req.query.savedOnly === 'true',
    });

    res.status(200).json({
      ok: true,
      count: pitches.length,
      data: pitches,
    });
  } catch (err) {
    console.error('Investor pitches error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to load investor pitches.',
    });
  }
});

/**
 * POST /api/investor/watchlist/toggle
 * Adds or removes a published pitch from investor saved list.
 * Requires INVESTOR role.
 */
app.post('/api/investor/watchlist/toggle', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['INVESTOR']);
  if (!user) return;

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'INVALID_BODY', message: 'A JSON object is required.' });
    return;
  }

  const pitchId = Number(req.body.pitchId);
  if (!Number.isSafeInteger(pitchId) || pitchId < 1) {
    res.status(400).json({
      error: 'INVALID_PITCH_ID',
      message: 'Valid pitch ID required.',
    });
    return;
  }

  try {
    const result = await toggleWatchlist(user.userId, pitchId);
    if (!('saved' in result)) {
      res.status(result.status).json({ error: result.error, message: result.message });
      return;
    }
    res.status(200).json({
      ok: true,
      saved: result.saved,
      message: result.saved ? 'Saved to watchlist.' : 'Removed from watchlist.',
    });
  } catch (err) {
    console.error('Watchlist toggle error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to update watchlist.',
    });
  }
});

// ============================================================================
// CONNECTIONS & MESSAGING ENDPOINTS
// ============================================================================

/**
 * POST /api/connections/request
 * Initiates an investor-to-founder connection request for a published PLATFORM pitch.
 * Requires INVESTOR role.
 */
app.post('/api/connections/request', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['INVESTOR']);
  if (!user) return;

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'INVALID_BODY', message: 'A JSON object is required.' });
    return;
  }

  const pitchId = Number(req.body.pitchId);
  if (!Number.isSafeInteger(pitchId) || pitchId < 1) {
    res.status(400).json({
      error: 'INVALID_PITCH_ID',
      message: 'Valid pitch ID required.',
    });
    return;
  }

  try {
    const result = await createConnectionRequest(user.userId, pitchId, req.body?.initialMessage);
    if (!result.success) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
      });
      return;
    }

    res.status(201).json({
      ok: true,
      requestId: result.requestId,
      request: result.request,
      message: 'Connection request initiated successfully.',
    });
  } catch (err) {
    console.error('Connection request error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to send connection request.',
    });
  }
});

/**
 * GET /api/connections
 * Returns user connections grouped by status (incoming, sent, active, ended).
 * Accessible to users with FOUNDER or INVESTOR role.
 */
app.get('/api/connections', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['FOUNDER', 'INVESTOR']);
  if (!user) return;

  try {
    const data = await getUserConnections(user.userId);
    res.status(200).json({
      ok: true,
      ...data,
    });
  } catch (err) {
    console.error('Get connections error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to fetch connections.',
    });
  }
});

/**
 * POST /api/connections/:requestId/respond
 * Recipient founder accepts or declines a pending connection request.
 * Requires FOUNDER role and recipient validation.
 */
app.post('/api/connections/:requestId/respond', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['FOUNDER']);
  if (!user) return;

  const requestId = Number(req.params.requestId);
  if (!Number.isSafeInteger(requestId) || requestId < 1) {
    res.status(400).json({ error: 'INVALID_REQUEST_ID', message: 'Valid request ID required.' });
    return;
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'INVALID_BODY', message: 'A JSON object is required.' });
    return;
  }
  const action = req.body.action;

  if (action !== 'ACCEPT' && action !== 'DECLINE') {
    res.status(400).json({
      error: 'INVALID_ACTION',
      message: "Action must be either 'ACCEPT' or 'DECLINE'.",
    });
    return;
  }

  try {
    const result = await respondToConnectionRequest(user.userId, requestId, action, req.body.reason);
    if (!result.success) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      request: result.request,
      message: `Connection request ${action.toLowerCase()}ed successfully.`,
    });
  } catch (err) {
    console.error('Connection response error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to respond to connection request.',
    });
  }
});

/**
 * POST /api/connections/:requestId/withdraw
 * The requesting investor may withdraw their own pending request only.
 */
app.post('/api/connections/:requestId/withdraw', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['INVESTOR']);
  if (!user) return;
  const requestId = Number(req.params.requestId);
  if (!Number.isSafeInteger(requestId) || requestId < 1) {
    res.status(400).json({ error: 'INVALID_REQUEST_ID', message: 'Valid request ID required.' });
    return;
  }
  if (req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) {
    res.status(400).json({ error: 'INVALID_BODY', message: 'A JSON object is required.' });
    return;
  }
  try {
    const result = await withdrawConnectionRequest(user.userId, requestId, req.body?.reason);
    if (!result.success) {
      res.status(result.status).json({ error: result.error, message: result.message });
      return;
    }
    res.status(200).json({ ok: true, request: result.request, message: 'Connection request withdrawn.' });
  } catch (err) {
    console.error('Withdraw connection request error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to withdraw connection request.' });
  }
});

/**
 * POST /api/connections/:requestId/end
 * Either participant in an active connection can end it.
 */
app.post('/api/connections/:requestId/end', async (req, res) => {
  const user = await requireAuthAndRole(req, res);
  if (!user) return;

  const requestId = Number(req.params.requestId);
  if (!Number.isSafeInteger(requestId) || requestId < 1) {
    res.status(400).json({ error: 'INVALID_REQUEST_ID', message: 'Valid request ID required.' });
    return;
  }
  try {
    const result = await endConnection(user.userId, requestId);
    if (!result.success) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      request: result.request,
      message: 'Connection ended. Conversation is now read-only.',
    });
  } catch (err) {
    console.error('End connection error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to end connection.',
    });
  }
});

/**
 * GET /api/conversations/:conversationId/messages
 * Retrieves conversation details and chronological message thread.
 * Enforces participant authorization.
 */
app.get('/api/conversations/:conversationId/messages', async (req, res) => {
  const user = await requireAuthAndRole(req, res);
  if (!user) return;

  const conversationId = Number(req.params.conversationId);
  if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
    res.status(400).json({ error: 'INVALID_CONVERSATION_ID', message: 'Valid conversation ID required.' });
    return;
  }
  try {
    const result = await getConversationMessages(user.userId, conversationId);
    if (!result.success) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      ...result.conversation,
    });
  } catch (err) {
    console.error('Get conversation messages error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to load conversation messages.',
    });
  }
});

/**
 * POST /api/conversations/:conversationId/messages
 * Sends a message in an open conversation. Enforces participant authorization and rejects sends in read-only/closed conversations.
 */
app.post('/api/conversations/:conversationId/messages', async (req, res) => {
  const user = await requireAuthAndRole(req, res);
  if (!user) return;

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'INVALID_BODY', message: 'A JSON object is required.' });
    return;
  }

  const conversationId = Number(req.params.conversationId);
  const messageBody: unknown = req.body?.messageBody;

  if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
    res.status(400).json({
      error: 'INVALID_CONVERSATION_ID',
      message: 'Valid conversation ID required.',
    });
    return;
  }

  // Type, emptiness and length bounds are enforced in sendChatMessage (400 on violation).

  try {
    const result = await sendChatMessage(user.userId, conversationId, messageBody);
    if (!result.success) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
      });
      return;
    }

    res.status(201).json({
      ok: true,
      message: result.message,
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to send message.',
    });
  }
});

// ============================================================================
// HISTORICAL EXPLORER, COMPARISON & STATISTICS (public read routes)
// ============================================================================

app.get('/api/historical/seasons', async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>, { defaultLimit: 50, maxLimit: 100 });
    const franchise = typeof req.query.franchise === 'string' ? req.query.franchise.trim() : undefined;
    const data = await listHistoricalSeasons(limit, offset, franchise || undefined);
    res.status(200).json({ ok: true, count: data.length, data });
  } catch (error) { sendHistoricalError(res, error, 'Failed to load historical seasons.'); }
});

app.get('/api/historical/seasons/:seasonId/episodes', async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>, { defaultLimit: 100, maxLimit: 100 });
    const data = await listHistoricalEpisodes(req.params.seasonId, limit, offset);
    res.status(200).json({ ok: true, count: data.length, data });
  } catch (error) { sendHistoricalError(res, error, 'Failed to load historical episodes.'); }
});

app.get('/api/historical/episodes/:episodeId', async (req, res) => {
  try {
    const data = await getHistoricalEpisodeDetail(req.params.episodeId);
    res.status(200).json({ ok: true, ...data });
  } catch (error) { sendHistoricalError(res, error, 'Failed to load historical episode.'); }
});

app.get('/api/historical/pitches', async (req, res) => {
  try {
    const idFilter = (key: string) => {
      const value = req.query[key];
      if (value === undefined || value === '') return undefined;
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 1) throw new HistoricalServiceError(400, 'INVALID_FILTER', `${key} must be a positive integer.`);
      return parsed;
    };
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>, { defaultLimit: 50, maxLimit: 100 });
    const dealStatusRaw = typeof req.query.dealStatus === 'string' ? req.query.dealStatus : undefined;
    const allowedDealStatus = ['PENDING_DUE_DILIGENCE', 'COMPLETED', 'FELL_THROUGH', 'UNKNOWN'];
    if (dealStatusRaw && !allowedDealStatus.includes(dealStatusRaw)) {
      res.status(400).json({ error: 'INVALID_FILTER', message: 'dealStatus filter is invalid.' }); return;
    }
    const data = await searchHistoricalPitches({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      seasonId: idFilter('seasonId'), industryId: idFilter('industryId'), sharkId: idFilter('sharkId'),
      dealStatus: dealStatusRaw as 'PENDING_DUE_DILIGENCE' | 'COMPLETED' | 'FELL_THROUGH' | 'UNKNOWN' | undefined,
      limit, offset,
    });
    res.status(200).json({ ok: true, count: data.length, data });
  } catch (error) { sendHistoricalError(res, error, 'Failed to search historical pitches.'); }
});

app.get('/api/historical/sharks', async (_req, res) => {
  try { const data = await listHistoricalSharks(); res.status(200).json({ ok: true, count: data.length, data }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to load historical Sharks.'); }
});

app.post('/api/startups/compare', async (req, res) => {
  try {
    const result = await compareStartups(req.body?.companyIds);
    res.status(200).json({ ok: true, ...result });
  } catch (error) { sendHistoricalError(res, error, 'Failed to compare startups.'); }
});

app.get('/api/statistics/historical', async (_req, res) => {
  try { res.status(200).json({ ok: true, ...(await getHistoricalStatistics()) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to calculate historical statistics.'); }
});

// ============================================================================
// ADMIN HISTORICAL DATA MANAGEMENT & VALIDATED CSV IMPORT
// ============================================================================

app.post('/api/admin/historical/seasons', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(201).json({ ok: true, ...(await createHistoricalSeason(req.body)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to create historical season.'); }
});
app.put('/api/admin/historical/seasons/:seasonId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await updateHistoricalSeason(req.params.seasonId, req.body)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to update historical season.'); }
});
app.delete('/api/admin/historical/seasons/:seasonId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await deleteHistoricalSeason(req.params.seasonId)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to delete historical season.'); }
});
app.post('/api/admin/historical/episodes', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(201).json({ ok: true, ...(await createHistoricalEpisode(req.body)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to create historical episode.'); }
});
app.put('/api/admin/historical/episodes/:episodeId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await updateHistoricalEpisode(req.params.episodeId, req.body)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to update historical episode.'); }
});
app.delete('/api/admin/historical/episodes/:episodeId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await deleteHistoricalEpisode(req.params.episodeId)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to delete historical episode.'); }
});
app.put('/api/admin/historical/episodes/:episodeId/sharks/:sharkId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await assignHistoricalEpisodeSharkSeat(req.params.episodeId, req.params.sharkId, req.body)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to assign Shark to historical episode.'); }
});
app.delete('/api/admin/historical/episodes/:episodeId/sharks/:sharkId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await removeHistoricalEpisodeSharkSeat(req.params.episodeId, req.params.sharkId)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to remove Shark from historical episode.'); }
});
app.post('/api/admin/historical/pitches', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(201).json({ ok: true, ...(await createHistoricalPitch(req.body)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to create historical pitch.'); }
});
app.put('/api/admin/historical/pitches/:pitchId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await updateHistoricalPitch(req.params.pitchId, req.body)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to update historical pitch.'); }
});
app.delete('/api/admin/historical/pitches/:pitchId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await deleteHistoricalPitch(req.params.pitchId)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to delete historical pitch.'); }
});
app.post('/api/admin/historical/sharks', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(201).json({ ok: true, ...(await createHistoricalShark(req.body)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to create historical Shark.'); }
});
app.put('/api/admin/historical/sharks/:sharkId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await updateHistoricalShark(req.params.sharkId, req.body)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to update historical Shark.'); }
});
app.delete('/api/admin/historical/sharks/:sharkId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await deleteHistoricalShark(req.params.sharkId)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to delete historical Shark.'); }
});
app.post('/api/admin/historical/offers', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(201).json({ ok: true, ...(await createHistoricalOffer(req.body)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to create historical offer.'); }
});
app.put('/api/admin/historical/offers/:offerId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await updateHistoricalOffer(req.params.offerId, req.body)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to update historical offer.'); }
});
app.delete('/api/admin/historical/offers/:offerId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await deleteHistoricalOffer(req.params.offerId)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to delete historical offer.'); }
});
app.post('/api/admin/historical/deals', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await upsertHistoricalDeal(req.body, user.userId)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to save historical deal outcome.'); }
});
app.delete('/api/admin/historical/pitches/:pitchId/deal', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await deleteHistoricalDeal(req.params.pitchId)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to delete historical deal outcome.'); }
});
app.post('/api/admin/historical/import/pitches', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'INVALID_BODY', message: 'A JSON object with a csv string is required.' }); return;
  }
  try { res.status(200).json({ ok: true, report: await importHistoricalPitchesCsv(req.body.csv, user.userId) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to import historical pitches.'); }
});
app.get('/api/admin/historical/imports', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try {
    res.status(200).json({ ok: true, imports: await listHistoricalImportReports(req.query.limit, req.query.offset) });
  } catch (error) { sendHistoricalError(res, error, 'Failed to load historical import reports.'); }
});
app.get('/api/admin/historical/imports/:importId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['ADMIN']); if (!user) return;
  try { res.status(200).json({ ok: true, ...(await getHistoricalImportReport(req.params.importId)) }); }
  catch (error) { sendHistoricalError(res, error, 'Failed to load historical import report.'); }
});

app.post('/api/admin/users/:userId/roles', async (req, res) => {
  const actor = await requireAuthAndRole(req, res, ['ADMIN']);
  if (!actor) return;
  const targetUserId = Number(req.params.userId);
  if (!Number.isSafeInteger(targetUserId) || targetUserId < 1) {
    res.status(400).json({ error: 'INVALID_USER_ID', message: 'Valid user ID required.' }); return;
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'INVALID_BODY', message: 'A JSON object with roleName and action is required.' }); return;
  }
  const roleName = typeof req.body.roleName === 'string' ? req.body.roleName.trim().toUpperCase() : '';
  const action = req.body.action;
  if (!['VIEWER', 'FOUNDER', 'INVESTOR', 'ADMIN'].includes(roleName) || !['GRANT', 'REVOKE'].includes(action)) {
    res.status(400).json({ error: 'INVALID_ROLE_CHANGE', message: 'roleName must be VIEWER, FOUNDER, INVESTOR or ADMIN; action must be GRANT or REVOKE.' }); return;
  }
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    // Serialize all ADMIN revocations through the role row before taking user locks,
    // so concurrent revocations cannot each observe multiple admins and remove the last one.
    if (roleName === 'ADMIN' && action === 'REVOKE') {
      const [adminRoleLock] = await conn.execute<RowDataPacket[]>(
        'SELECT role_id FROM app_role WHERE role_name = ? FOR UPDATE', ['ADMIN'],
      );
      if (!adminRoleLock.length) {
        await conn.rollback(); res.status(500).json({ error: 'ROLE_NOT_CONFIGURED', message: 'ADMIN role is not configured.' }); return;
      }
    }
    const [users] = await conn.execute<RowDataPacket[]>(
      `SELECT user_id AS userId, full_name AS fullName, email, account_status AS accountStatus
       FROM app_user WHERE user_id = ? FOR UPDATE`, [targetUserId],
    );
    if (!users.length || users[0].accountStatus !== 'ACTIVE') {
      await conn.rollback(); res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Active target account not found.' }); return;
    }
    const [roles] = await conn.execute<RowDataPacket[]>('SELECT role_id AS roleId FROM app_role WHERE role_name = ?', [roleName]);
    if (!roles.length) { await conn.rollback(); res.status(500).json({ error: 'ROLE_NOT_CONFIGURED', message: `Role ${roleName} is not configured.` }); return; }
    const roleId = Number(roles[0].roleId);
    const [present] = await conn.execute<RowDataPacket[]>('SELECT user_id FROM user_role WHERE user_id = ? AND role_id = ? FOR UPDATE', [targetUserId, roleId]);
    if (action === 'GRANT') {
      if (!present.length) {
        await conn.execute('INSERT INTO user_role (user_id, role_id) VALUES (?, ?)', [targetUserId, roleId]);
        await conn.execute(`INSERT INTO application_audit_log (table_name, operation_type, record_id, old_data, new_data) VALUES ('user_role', 'INSERT', ?, NULL, JSON_OBJECT('roleName', ?))`, [targetUserId, roleName]);
      }
      // Role-specific routes require the backing profile row as well as user_role.
      const nameParts = String(users[0].fullName || users[0].email.split('@')[0]).trim().split(/\s+/);
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || (roleName === 'FOUNDER' ? 'Founder' : 'Investor');
      if (roleName === 'FOUNDER') {
        await conn.execute(
          `INSERT INTO founder (user_id, first_name, last_name, email) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE first_name = VALUES(first_name)`,
          [targetUserId, firstName, lastName, users[0].email],
        );
      } else if (roleName === 'INVESTOR') {
        await conn.execute(
          `INSERT INTO investor (user_id, first_name, last_name, display_name) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
          [targetUserId, firstName, lastName, users[0].fullName],
        );
      }
    } else if (action === 'REVOKE' && present.length) {
      if (roleName === 'ADMIN') {
        const [admins] = await conn.execute<RowDataPacket[]>(
          `SELECT COUNT(DISTINCT ur.user_id) AS activeAdmins FROM user_role ur
           JOIN app_role r ON r.role_id = ur.role_id JOIN app_user u ON u.user_id = ur.user_id
           WHERE r.role_name = 'ADMIN' AND u.account_status = 'ACTIVE'`,
        );
        if (Number(admins[0]?.activeAdmins ?? 0) <= 1) {
          await conn.rollback(); res.status(409).json({ error: 'LAST_ADMIN', message: 'The last active Administrator cannot be removed.' }); return;
        }
      }
      await conn.execute('DELETE FROM user_role WHERE user_id = ? AND role_id = ?', [targetUserId, roleId]);
      await conn.execute(`INSERT INTO application_audit_log (table_name, operation_type, record_id, old_data, new_data) VALUES ('user_role', 'DELETE', ?, JSON_OBJECT('roleName', ?), NULL)`, [targetUserId, roleName]);
    }
    await conn.commit();
    const [current] = await dbPool.execute<RowDataPacket[]>(
      `SELECT r.role_name AS roleName FROM user_role ur JOIN app_role r ON r.role_id = ur.role_id WHERE ur.user_id = ? ORDER BY r.role_name`, [targetUserId],
    );
    res.status(200).json({ ok: true, userId: targetUserId, roles: current.map(row => row.roleName), action, roleName });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    console.error('Admin role-management error:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to change user role.' });
  } finally { conn.release(); }
});

app.get('/api/startups', async (req, res) => {
  let limit = 20;
  const requestedLimit = req.query.limit;

  if (requestedLimit !== undefined) {
    if (
      typeof requestedLimit !== 'string' ||
      !/^\d+$/.test(requestedLimit)
    ) {
      res.status(400).json({
        error: 'limit must be an integer between 1 and 100'
      });
      return;
    }

    limit = Number(requestedLimit);

    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      res.status(400).json({
        error: 'limit must be an integer between 1 and 100'
      });
      return;
    }
  }

  try {
    const [rows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT
         p.pitch_id AS pitchId,
         p.pitch_type AS pitchType,
         p.original_ask_amount AS originalAskAmount,
         p.original_ask_equity_pct AS originalAskEquityPct,
         p.pitch_hook AS pitchHook,
         p.submitted_at AS submittedAt,
         c.company_id AS companyId,
         c.brand_name AS brandName,
         c.legal_business_name AS legalBusinessName,
         c.business_model AS businessModel,
         c.website_url AS websiteUrl,
         c.founded_year AS foundedYear,
         c.headquarters_city AS headquartersCity,
         c.headquarters_state AS headquartersState,
         c.headquarters_country AS headquartersCountry,
         i.industry_name AS industry,
         s.stage_name AS startupStage
       FROM pitch AS p
       INNER JOIN company AS c
         ON c.company_id = p.company_id
       LEFT JOIN industry AS i
         ON i.industry_id = c.industry_id
       LEFT JOIN startup_stage AS s
         ON s.stage_id = c.stage_id
       WHERE p.pitch_status = 'PUBLISHED'
       ORDER BY p.submitted_at DESC, p.pitch_id DESC
       LIMIT ?`,
      [limit]
    );

    res.status(200).json({
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Failed to fetch startups:', error);
    res.status(500).json({
      error: 'Unable to fetch startups'
    });
  }
});

// Centralised error handler: malformed / oversized JSON bodies return clear 4xx responses.
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'INVALID_JSON', message: 'Request body is not valid JSON.' });
    return;
  }
  if (err instanceof ValidationError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  console.error('Unhandled request error:', err?.message ?? err);
  res.status(500).json({ error: 'SERVER_ERROR', message: 'Unexpected server error.' });
});

app.listen(PORT, async () => {
  console.log(`Shark Tank DBMS API running at http://localhost:${PORT}`);
  try {
    const [cols] = await dbPool.query<RowDataPacket[]>('SHOW COLUMNS FROM app_user');
    console.log('[Auth DB Check] app_user columns:', cols.map((c: any) => c.Field));
    const [roles] = await dbPool.query<RowDataPacket[]>('SELECT role_id, role_name FROM app_role');
    console.log('[Auth DB Check] app_role rows:', roles);
    const [userRoleCols] = await dbPool.query<RowDataPacket[]>('SHOW COLUMNS FROM user_role');
    console.log('[Auth DB Check] user_role columns:', userRoleCols.map((c: any) => c.Field));
    const [statuses] = await dbPool.query<RowDataPacket[]>('SELECT DISTINCT account_status FROM app_user');
    console.log('[Auth DB Check] distinct account_status:', statuses);
  } catch (err: any) {
    console.error('[Auth DB Check] Failed:', err.code, err.sqlMessage || err.message, err);
  }
});
