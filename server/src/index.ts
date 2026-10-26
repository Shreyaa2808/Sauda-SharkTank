
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
} from './auth.js';
import {
  getMetadata,
  getFounderDashboard,
  createFounderPitch,
  updateFounderPitch,
  getInvestorDashboard,
  getInvestorPitches,
  getInvestorPitchById,
  toggleWatchlist,
  createConnectionRequest,
  getUserConnections,
  respondToConnectionRequest,
  withdrawConnectionRequest,
  endConnection,
  getConversationMessages,
  sendChatMessage,
} from './workspaces.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

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

  const { fullName, phoneNumber } = req.body;
  if (typeof fullName !== 'string') {
    res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'fullName is required and must be a string.',
    });
    return;
  }

  try {
    const result = await updateUserProfile(session.userId, {
      fullName,
      phoneNumber: typeof phoneNumber === 'string' || phoneNumber === null ? phoneNumber : null,
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
    res.status(401).json({
      error: 'UNAUTHORIZED',
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

  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = allowedRoles.some((r) => user.roles.includes(r));
    if (!hasRole) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `This action requires one of the following workspace roles: ${allowedRoles.join(', ')}.`,
      });
      return null;
    }
  }

  return user;
}

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

  try {
    const result = await createFounderPitch(user.userId, req.body);
    if (!result.success) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
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
  if (!Number.isInteger(pitchId) || pitchId < 1) {
    res.status(400).json({
      error: 'INVALID_PITCH_ID',
      message: 'Valid pitch ID required.',
    });
    return;
  }

  try {
    const result = await updateFounderPitch(user.userId, pitchId, req.body);
    if (!result.success) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
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
 * GET /api/investor/pitches/:pitchId
 * Returns complete details for a single published pitch with live connection and saved status.
 * Returns 404 if pitch does not exist or is unpublished/draft.
 * Requires INVESTOR role.
 */
app.get('/api/investor/pitches/:pitchId', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['INVESTOR']);
  if (!user) return;

  const pitchId = Number(req.params.pitchId);
  if (!Number.isInteger(pitchId) || pitchId < 1) {
    res.status(400).json({
      error: 'INVALID_PITCH_ID',
      message: 'Valid pitch ID required.',
    });
    return;
  }

  try {
    const result = await getInvestorPitchById(user.userId, pitchId);
    if (!result.success) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      pitch: result.pitch,
    });
  } catch (err) {
    console.error('Investor pitch detail error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve pitch details.',
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

  const pitchId = Number(req.body.pitchId);
  if (!Number.isInteger(pitchId) || pitchId < 1) {
    res.status(400).json({
      error: 'INVALID_PITCH_ID',
      message: 'Valid pitch ID required.',
    });
    return;
  }

  try {
    const result = await toggleWatchlist(user.userId, pitchId);
    if (!result.success) {
      res.status(result.status).json({
        error: result.error,
        message: result.message,
      });
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

  const pitchId = Number(req.body.pitchId);
  if (!Number.isInteger(pitchId) || pitchId < 1) {
    res.status(400).json({
      error: 'INVALID_PITCH_ID',
      message: 'Valid pitch ID required.',
    });
    return;
  }

  try {
    const result = await createConnectionRequest(user.userId, pitchId, req.body.initialMessage);
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
 * Initiator/sender withdraws their pending connection request.
 * Requires caller to be the investor initiator.
 */
app.post('/api/connections/:requestId/withdraw', async (req, res) => {
  const user = await requireAuthAndRole(req, res, ['INVESTOR']);
  if (!user) return;

  const requestId = Number(req.params.requestId);
  if (!Number.isInteger(requestId) || requestId < 1) {
    res.status(400).json({
      error: 'INVALID_REQUEST_ID',
      message: 'Valid request ID required.',
    });
    return;
  }

  try {
    const result = await withdrawConnectionRequest(user.userId, requestId);
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
      message: 'Connection request withdrawn successfully.',
    });
  } catch (err) {
    console.error('Withdraw connection error:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to withdraw connection request.',
    });
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

  const conversationId = Number(req.params.conversationId);
  const { messageBody } = req.body;

  if (typeof messageBody !== 'string' || !messageBody.trim()) {
    res.status(400).json({
      error: 'INVALID_MESSAGE',
      message: 'Message body cannot be empty.',
    });
    return;
  }

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
