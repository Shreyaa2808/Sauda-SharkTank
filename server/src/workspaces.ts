import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { dbPool } from './db.js';

// Input bounds (kept in sync with the client-side maxLength on the same fields).
export const MAX_INTRO_MESSAGE_LENGTH = 1000;
export const MAX_CHAT_MESSAGE_LENGTH = 2000;

type BoundedTextResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string; message: string };

function isMysqlDuplicateEntryError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ER_DUP_ENTRY'
  );
}

/**
 * Validates optional/required free-text input: must be a string, non-blank when required,
 * and no longer than maxLength (after trimming).
 */
function validateBoundedText(
  input: unknown,
  opts: { required: boolean; maxLength: number; label: string; emptyError: string; typeError?: string; lengthError?: string },
): BoundedTextResult {
  if (input === undefined || input === null) {
    return opts.required
      ? { ok: false, error: opts.emptyError, message: `${opts.label} cannot be empty.` }
      : { ok: true, value: null };
  }
  if (typeof input !== 'string') {
    return { ok: false, error: opts.typeError || 'INVALID_MESSAGE', message: `${opts.label} must be text.` };
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return opts.required
      ? { ok: false, error: opts.emptyError, message: `${opts.label} cannot be empty.` }
      : { ok: true, value: null };
  }
  if (trimmed.length > opts.maxLength) {
    return {
      ok: false,
      error: opts.lengthError || 'MESSAGE_TOO_LONG',
      message: `${opts.label} must be ${opts.maxLength} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

// ============================================================================
// METADATA (INDUSTRIES & STAGES)
// ============================================================================

export interface IndustryOption {
  industryId: number;
  industryName: string;
  description: string | null;
}

export interface StageOption {
  stageId: number;
  stageName: string;
}

export async function getMetadata(): Promise<{
  industries: IndustryOption[];
  stages: StageOption[];
}> {
  const [industries] = await dbPool.execute<RowDataPacket[]>(
    `SELECT industry_id AS industryId, industry_name AS industryName, description
     FROM industry
     ORDER BY industry_name ASC`,
  );

  const [stages] = await dbPool.execute<RowDataPacket[]>(
    `SELECT stage_id AS stageId, stage_name AS stageName
     FROM startup_stage
     ORDER BY stage_id ASC`,
  );

  return {
    industries: industries as IndustryOption[],
    stages: stages as StageOption[],
  };
}

// ============================================================================
// INVESTOR WORKSPACE
// ============================================================================

export interface InvestorDashboardMetrics {
  publishedPlatformCount: number;
  publishedShowCount: number;
  totalPublishedCount: number;
  sentRequestsCount: number;
  activeConnectionsCount: number;
  savedPitchesCount: number;
}

export interface InvestorPitchItem {
  pitchId: number;
  companyId: number;
  pitchType: 'SHOW' | 'PLATFORM';
  brandName: string;
  legalBusinessName: string | null;
  businessModel: string | null;
  websiteUrl: string | null;
  foundedYear: number | null;
  headquartersCity: string | null;
  headquartersState: string | null;
  headquartersCountry: string | null;
  industry: string | null;
  startupStage: string | null;
  originalAskAmount: number | string | null;
  originalAskEquityPct: number | string | null;
  pitchHook: string | null;
  submittedAt: string;
  founderUserId: number | null;
  founderName: string | null;
  isSaved: boolean;
  connectionStatus: 'PENDING' | 'ACCEPTED' | null;
  connectionRequestId: number | null;
}

export async function getInvestorDashboard(userId: number): Promise<InvestorDashboardMetrics> {
  // 1. Total and breakdown of published pitches
  const [platformRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM pitch WHERE pitch_type = 'PLATFORM' AND pitch_status = 'PUBLISHED'`,
  );
  const [showRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM pitch WHERE pitch_type = 'SHOW' AND pitch_status = 'PUBLISHED'`,
  );

  // 2. Investor connection requests
  const [requestsRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS totalSent,
       SUM(CASE WHEN request_status = 'ACCEPTED' THEN 1 ELSE 0 END) AS activeCount
     FROM connection_request
     WHERE investor_user_id = ?`,
    [userId],
  );

  // 3. Saved watchlist pitches
  const [savedRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM user_saved_pitch WHERE user_id = ?`,
    [userId],
  );

  const publishedPlatformCount = Number(platformRows[0]?.cnt || 0);
  const publishedShowCount = Number(showRows[0]?.cnt || 0);
  const sentRequestsCount = Number(requestsRows[0]?.totalSent || 0);
  const activeConnectionsCount = Number(requestsRows[0]?.activeCount || 0);
  const savedPitchesCount = Number(savedRows[0]?.cnt || 0);

  return {
    publishedPlatformCount,
    publishedShowCount,
    totalPublishedCount: publishedPlatformCount + publishedShowCount,
    sentRequestsCount,
    activeConnectionsCount,
    savedPitchesCount,
  };
}

export interface InvestorPitchesFilter {
  search?: string;
  industry?: string;
  stage?: string;
  source?: 'ALL' | 'SHOW' | 'PLATFORM';
  sortBy?: 'latest' | 'ask_asc' | 'ask_desc' | 'brand_name';
  savedOnly?: boolean;
}

export async function getInvestorPitches(
  userId: number,
  filters: InvestorPitchesFilter = {},
): Promise<InvestorPitchItem[]> {
  const whereClauses: string[] = [`p.pitch_status = 'PUBLISHED'`];
  const queryParams: any[] = [userId, userId];

  if (filters.source && filters.source !== 'ALL') {
    whereClauses.push('p.pitch_type = ?');
    queryParams.push(filters.source);
  }

  if (filters.industry && filters.industry !== 'ALL') {
    whereClauses.push('i.industry_name = ?');
    queryParams.push(filters.industry);
  }

  if (filters.stage && filters.stage !== 'ALL') {
    whereClauses.push('s.stage_name = ?');
    queryParams.push(filters.stage);
  }

  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    whereClauses.push(
      `(LOWER(c.brand_name) LIKE ? OR LOWER(COALESCE(c.legal_business_name, '')) LIKE ? OR LOWER(COALESCE(p.pitch_hook, '')) LIKE ?)`,
    );
    queryParams.push(term, term, term);
  }

  if (filters.savedOnly) {
    whereClauses.push('usp.pitch_id IS NOT NULL');
  }

  const SORT_ORDERS: Record<string, string> = {
    latest: 'p.submitted_at DESC, p.pitch_id DESC',
    ask_asc: 'p.original_ask_amount ASC, p.pitch_id DESC',
    ask_desc: 'p.original_ask_amount DESC, p.pitch_id DESC',
    brand_name: 'c.brand_name ASC, p.pitch_id DESC',
  };
  const orderBy = (filters.sortBy && SORT_ORDERS[filters.sortBy]) ? SORT_ORDERS[filters.sortBy] : SORT_ORDERS.latest;

  const query = `
    SELECT
      p.pitch_id AS pitchId,
      p.company_id AS companyId,
      p.pitch_type AS pitchType,
      p.original_ask_amount AS originalAskAmount,
      p.original_ask_equity_pct AS originalAskEquityPct,
      p.pitch_hook AS pitchHook,
      p.submitted_at AS submittedAt,
      p.submitted_by_user_id AS founderUserId,
      u.full_name AS founderName,
      c.brand_name AS brandName,
      c.legal_business_name AS legalBusinessName,
      c.business_model AS businessModel,
      c.website_url AS websiteUrl,
      c.founded_year AS foundedYear,
      c.headquarters_city AS headquartersCity,
      c.headquarters_state AS headquartersState,
      c.headquarters_country AS headquartersCountry,
      i.industry_name AS industry,
      s.stage_name AS startupStage,
      CASE WHEN usp.pitch_id IS NOT NULL THEN 1 ELSE 0 END AS isSaved,
      cr.request_status AS connectionStatus,
      cr.request_id AS connectionRequestId
    FROM pitch p
    INNER JOIN company c ON c.company_id = p.company_id
    LEFT JOIN industry i ON i.industry_id = c.industry_id
    LEFT JOIN startup_stage s ON s.stage_id = c.stage_id
    LEFT JOIN app_user u ON u.user_id = p.submitted_by_user_id
    LEFT JOIN user_saved_pitch usp ON usp.pitch_id = p.pitch_id AND usp.user_id = ?
    LEFT JOIN connection_request cr ON cr.pitch_id = p.pitch_id AND cr.investor_user_id = ? AND cr.request_status IN ('PENDING', 'ACCEPTED')
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY ${orderBy}
  `;

  const [rows] = await dbPool.execute<RowDataPacket[]>(query, queryParams);

  return rows.map((r) => ({
    pitchId: r.pitchId,
    companyId: r.companyId,
    pitchType: r.pitchType,
    brandName: r.brandName,
    legalBusinessName: r.legalBusinessName,
    businessModel: r.businessModel,
    websiteUrl: r.websiteUrl,
    foundedYear: r.foundedYear,
    headquartersCity: r.headquartersCity,
    headquartersState: r.headquartersState,
    headquartersCountry: r.headquartersCountry,
    industry: r.industry,
    startupStage: r.startupStage,
    originalAskAmount: r.originalAskAmount,
    originalAskEquityPct: r.originalAskEquityPct,
    pitchHook: r.pitchHook,
    submittedAt: r.submittedAt,
    founderUserId: r.founderUserId,
    founderName: r.founderName,
    isSaved: Boolean(r.isSaved),
    connectionStatus: r.connectionStatus,
    connectionRequestId: r.connectionRequestId,
  }));
}

export async function toggleWatchlist(
  userId: number,
  pitchId: number,
): Promise<{ saved: boolean } | { success: false; status: number; error: string; message: string }> {
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    // Use the pitch as the serialization point for both first-time saves and archive
    // operations. A concurrent toggle for the same pitch waits, then sees the latest row.
    const [pitchRows] = await conn.execute<RowDataPacket[]>(
      `SELECT pitch_id, pitch_status FROM pitch WHERE pitch_id = ? FOR UPDATE`,
      [pitchId],
    );
    if (pitchRows.length === 0) {
      await conn.rollback();
      return { success: false, status: 404, error: 'PITCH_NOT_FOUND', message: 'Pitch listing not found.' };
    }
    const [existing] = await conn.execute<RowDataPacket[]>(
      `SELECT user_id FROM user_saved_pitch WHERE user_id = ? AND pitch_id = ? FOR UPDATE`,
      [userId, pitchId],
    );
    if (existing.length > 0) {
      await conn.execute(`DELETE FROM user_saved_pitch WHERE user_id = ? AND pitch_id = ?`, [userId, pitchId]);
      await conn.commit();
      return { saved: false };
    }

    if (pitchRows[0].pitch_status !== 'PUBLISHED') {
      await conn.rollback();
      return { success: false, status: 409, error: 'PITCH_NOT_VISIBLE', message: 'Only published pitches can be saved to a watchlist.' };
    }

    await conn.execute(
      `INSERT INTO user_saved_pitch (user_id, pitch_id, saved_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [userId, pitchId],
    );
    await conn.commit();
    return { saved: true };
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    if (isMysqlDuplicateEntryError(error)) {
      return { success: false, status: 409, error: 'WATCHLIST_CONFLICT', message: 'Watchlist changed concurrently. Refresh and try again.' };
    }
    throw error;
  } finally {
    conn.release();
  }
}

// ============================================================================
// CONNECTIONS & MESSAGING
// ============================================================================

export interface ConnectionRequestItem {
  requestId: number;
  pitchId: number;
  brandName: string;
  industryName: string | null;
  investorUserId: number;
  investorName: string;
  investorFirmName: string | null;
  founderUserId: number;
  founderName: string;
  requestStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'ENDED';
  initialMessage: string | null;
  statusReason: string | null;
  createdAt: string;
  respondedAt: string | null;
  withdrawnAt: string | null;
  endedAt: string | null;
  conversationId: number | null;
  conversationStatus: 'OPEN' | 'READ_ONLY' | null;
}

export async function createConnectionRequest(
  investorUserId: number,
  pitchId: number,
  initialMessage?: unknown,
): Promise<{ success: true; requestId: number; request: ConnectionRequestItem } | { success: false; status: number; error: string; message: string }> {
  const introCheck = validateBoundedText(initialMessage, {
    required: false,
    maxLength: MAX_INTRO_MESSAGE_LENGTH,
    label: 'Introduction message',
    emptyError: 'INVALID_MESSAGE',
  });
  if (!introCheck.ok) {
    return { success: false, status: 400, error: introCheck.error, message: introCheck.message };
  }

  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    // Serialize request creation with archiveFounderPitch by locking the same pitch
    // row before checking publication and before inserting a request. The lock order
    // is pitch -> request, matching the archive path's pitch-first order.
    const [pitchRows] = await conn.execute<RowDataPacket[]>(
      `SELECT p.pitch_id, p.pitch_type, p.pitch_status, p.submitted_by_user_id, c.brand_name
       FROM pitch p
       INNER JOIN company c ON c.company_id = p.company_id
       WHERE p.pitch_id = ?
       FOR UPDATE`,
      [pitchId],
    );
    if (pitchRows.length === 0) {
      await conn.rollback();
      return { success: false, status: 404, error: 'PITCH_NOT_FOUND', message: 'Pitch listing not found.' };
    }

    const pitch = pitchRows[0];
    if (pitch.pitch_type !== 'PLATFORM') {
      await conn.rollback();
      return {
        success: false,
        status: 400,
        error: 'PLATFORM_ONLY',
        message: 'Connection requests can only be initiated for registered Platform venture listings.',
      };
    }
    if (pitch.pitch_status !== 'PUBLISHED') {
      await conn.rollback();
      return {
        success: false,
        status: 409,
        error: 'PITCH_NOT_PUBLISHED',
        message: 'Connection requests can only be sent to published listings.',
      };
    }

    const founderUserId = Number(pitch.submitted_by_user_id);
    if (investorUserId === founderUserId) {
      await conn.rollback();
      return {
        success: false,
        status: 400,
        error: 'SELF_CONNECTION_FORBIDDEN',
        message: 'You cannot initiate a connection request with your own venture.',
      };
    }

    // Ensure profile rows required by foreign keys exist inside the same transaction.
    const [invRows] = await conn.execute<RowDataPacket[]>(
      `SELECT user_id FROM investor WHERE user_id = ? FOR UPDATE`,
      [investorUserId],
    );
    if (invRows.length === 0) {
      const [uRows] = await conn.execute<RowDataPacket[]>(
        `SELECT full_name FROM app_user WHERE user_id = ? AND account_status = 'ACTIVE'`,
        [investorUserId],
      );
      if (uRows.length === 0) {
        await conn.rollback();
        return { success: false, status: 401, error: 'USER_NOT_ACTIVE', message: 'Active investor account not found.' };
      }
      const nameParts = String(uRows[0].full_name || 'Investor').trim().split(/\s+/);
      await conn.execute(
        `INSERT INTO investor (user_id, first_name, last_name, display_name)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
        [investorUserId, nameParts[0], nameParts.slice(1).join(' ') || 'Investor', uRows[0].full_name],
      );
    }

    const [founderRows] = await conn.execute<RowDataPacket[]>(
      `SELECT user_id FROM founder WHERE user_id = ? FOR UPDATE`,
      [founderUserId],
    );
    if (founderRows.length === 0) {
      const [uRows] = await conn.execute<RowDataPacket[]>(
        `SELECT full_name, email FROM app_user WHERE user_id = ? AND account_status = 'ACTIVE'`,
        [founderUserId],
      );
      if (uRows.length === 0) {
        await conn.rollback();
        return { success: false, status: 409, error: 'FOUNDER_NOT_ACTIVE', message: 'The listing owner is not an active account.' };
      }
      const nameParts = String(uRows[0].full_name || 'Founder').trim().split(/\s+/);
      await conn.execute(
        `INSERT INTO founder (user_id, first_name, last_name, email)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE first_name = VALUES(first_name)`,
        [founderUserId, nameParts[0], nameParts.slice(1).join(' ') || 'Founder', uRows[0].email],
      );
    }

    const [existingActive] = await conn.execute<RowDataPacket[]>(
      `SELECT request_id, request_status
       FROM connection_request
       WHERE investor_user_id = ? AND founder_user_id = ? AND request_status IN ('PENDING', 'ACCEPTED')
       FOR UPDATE`,
      [investorUserId, founderUserId],
    );
    if (existingActive.length > 0) {
      await conn.rollback();
      return {
        success: false,
        status: 409,
        error: 'DUPLICATE_ACTIVE_REQUEST',
        message: 'An active connection request or active relationship already exists between you and this founder.',
      };
    }

    const [insertResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO connection_request (
         pitch_id, investor_user_id, founder_user_id, request_status, initial_message, created_at
       ) VALUES (?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP)`,
      [pitchId, investorUserId, founderUserId, introCheck.value],
    );
    const requestId = insertResult.insertId;
    await conn.commit();

    const request = await getConnectionRequestById(requestId);
    if (!request) throw new Error('Could not retrieve created connection request');
    return { success: true, requestId, request };
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    if (isMysqlDuplicateEntryError(err)) {
      return {
        success: false,
        status: 409,
        error: 'DUPLICATE_ACTIVE_REQUEST',
        message: 'An active connection request or active relationship already exists between you and this founder.',
      };
    }
    console.error('Failed to create connection request:', err);
    return { success: false, status: 500, error: 'SERVER_ERROR', message: 'Failed to initiate connection request.' };
  } finally {
    conn.release();
  }
}

export async function getConnectionRequestById(requestId: number): Promise<ConnectionRequestItem | null> {
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
       cr.request_id AS requestId,
       cr.pitch_id AS pitchId,
       c.brand_name AS brandName,
       i.industry_name AS industryName,
       cr.investor_user_id AS investorUserId,
       iu.full_name AS investorName,
       inv.investment_firm_name AS investorFirmName,
       cr.founder_user_id AS founderUserId,
       fu.full_name AS founderName,
       cr.request_status AS requestStatus,
       cr.initial_message AS initialMessage,
       cr.status_reason AS statusReason,
       cr.created_at AS createdAt,
       cr.responded_at AS respondedAt,
       cr.withdrawn_at AS withdrawnAt,
       cr.ended_at AS endedAt,
       conv.conversation_id AS conversationId,
       conv.conversation_status AS conversationStatus
     FROM connection_request cr
     INNER JOIN pitch p ON p.pitch_id = cr.pitch_id
     INNER JOIN company c ON c.company_id = p.company_id
     LEFT JOIN industry i ON i.industry_id = c.industry_id
     INNER JOIN app_user iu ON iu.user_id = cr.investor_user_id
     LEFT JOIN investor inv ON inv.user_id = cr.investor_user_id
     INNER JOIN app_user fu ON fu.user_id = cr.founder_user_id
     LEFT JOIN conversation conv ON conv.request_id = cr.request_id
     WHERE cr.request_id = ?`,
    [requestId],
  );

  if (rows.length === 0) return null;
  return rows[0] as ConnectionRequestItem;
}

export async function getUserConnections(userId: number): Promise<{
  incoming: ConnectionRequestItem[];
  sent: ConnectionRequestItem[];
  active: ConnectionRequestItem[];
  ended: ConnectionRequestItem[];
}> {
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
       cr.request_id AS requestId,
       cr.pitch_id AS pitchId,
       c.brand_name AS brandName,
       i.industry_name AS industryName,
       cr.investor_user_id AS investorUserId,
       iu.full_name AS investorName,
       inv.investment_firm_name AS investorFirmName,
       cr.founder_user_id AS founderUserId,
       fu.full_name AS founderName,
       cr.request_status AS requestStatus,
       cr.initial_message AS initialMessage,
       cr.status_reason AS statusReason,
       cr.created_at AS createdAt,
       cr.responded_at AS respondedAt,
       cr.withdrawn_at AS withdrawnAt,
       cr.ended_at AS endedAt,
       conv.conversation_id AS conversationId,
       conv.conversation_status AS conversationStatus
     FROM connection_request cr
     INNER JOIN pitch p ON p.pitch_id = cr.pitch_id
     INNER JOIN company c ON c.company_id = p.company_id
     LEFT JOIN industry i ON i.industry_id = c.industry_id
     INNER JOIN app_user iu ON iu.user_id = cr.investor_user_id
     LEFT JOIN investor inv ON inv.user_id = cr.investor_user_id
     INNER JOIN app_user fu ON fu.user_id = cr.founder_user_id
     LEFT JOIN conversation conv ON conv.request_id = cr.request_id
     WHERE cr.investor_user_id = ? OR cr.founder_user_id = ?
     ORDER BY cr.updated_at DESC, cr.created_at DESC`,
    [userId, userId],
  );

  const all = rows as ConnectionRequestItem[];

  // Group by category
  const incoming = all.filter((r) => r.founderUserId === userId && r.requestStatus === 'PENDING');
  const sent = all.filter((r) => r.investorUserId === userId && r.requestStatus === 'PENDING');
  const active = all.filter((r) => r.requestStatus === 'ACCEPTED');
  const ended = all.filter((r) => r.requestStatus === 'ENDED' || r.requestStatus === 'DECLINED' || r.requestStatus === 'WITHDRAWN');

  return { incoming, sent, active, ended };
}

export async function respondToConnectionRequest(
  userId: number,
  requestId: number,
  action: 'ACCEPT' | 'DECLINE',
  reason?: string,
): Promise<{ success: true; request: ConnectionRequestItem } | { success: false; status: number; error: string; message: string }> {
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock and re-read inside the transaction so concurrent decisions cannot
    // both act on a stale PENDING state.
    const [requestRows] = await conn.execute<RowDataPacket[]>(
      `SELECT
         request_id AS requestId,
         investor_user_id AS investorUserId,
         founder_user_id AS founderUserId,
         request_status AS requestStatus,
         initial_message AS initialMessage
       FROM connection_request
       WHERE request_id = ?
       FOR UPDATE`,
      [requestId],
    );

    if (requestRows.length === 0) {
      await conn.rollback();
      return {
        success: false,
        status: 404,
        error: 'REQUEST_NOT_FOUND',
        message: 'Connection request not found.',
      };
    }

    const request = requestRows[0];

    // Security check is made against the locked, current row.
    if (Number(request.founderUserId) !== Number(userId)) {
      await conn.rollback();
      return {
        success: false,
        status: 403,
        error: 'UNAUTHORIZED_RECIPIENT',
        message: 'Only the recipient founder of this connection request can respond to it.',
      };
    }

    if (request.requestStatus !== 'PENDING') {
      await conn.rollback();
      return {
        success: false,
        status: 400,
        error: 'INVALID_STATE',
        message: `Cannot respond to a request with status ${request.requestStatus}.`,
      };
    }

    if (action === 'ACCEPT') {
      const [updated] = await conn.execute<ResultSetHeader>(
        `UPDATE connection_request
         SET request_status = 'ACCEPTED',
             responded_at = CURRENT_TIMESTAMP
         WHERE request_id = ? AND request_status = 'PENDING'`,
        [requestId],
      );

      if (updated.affectedRows !== 1) {
        await conn.rollback();
        return {
          success: false,
          status: 409,
          error: 'INVALID_STATE',
          message: 'The request was already handled. Refresh the connections list and try again.',
        };
      }

      // The unique uq_conversation_request key is a second line of defence.
      const [convRes] = await conn.execute<ResultSetHeader>(
        `INSERT INTO conversation (request_id, conversation_status, created_at)
         VALUES (?, 'OPEN', CURRENT_TIMESTAMP)`,
        [requestId],
      );

      const conversationId = convRes.insertId;
      if (typeof request.initialMessage === 'string' && request.initialMessage.trim()) {
        await conn.execute(
          `INSERT INTO message (conversation_id, sender_user_id, message_body, created_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          [conversationId, Number(request.investorUserId), request.initialMessage.trim()],
        );
      }
    } else {
      const [updated] = await conn.execute<ResultSetHeader>(
        `UPDATE connection_request
         SET request_status = 'DECLINED',
             responded_at = CURRENT_TIMESTAMP,
             status_reason = ?
         WHERE request_id = ? AND request_status = 'PENDING'`,
        [reason?.trim() || null, requestId],
      );

      if (updated.affectedRows !== 1) {
        await conn.rollback();
        return {
          success: false,
          status: 409,
          error: 'INVALID_STATE',
          message: 'The request was already handled. Refresh the connections list and try again.',
        };
      }
    }

    await conn.commit();

    const updatedRequest = await getConnectionRequestById(requestId);
    if (!updatedRequest) {
      return {
        success: false,
        status: 500,
        error: 'SERVER_ERROR',
        message: 'The request was updated, but its current state could not be retrieved.',
      };
    }

    return { success: true, request: updatedRequest };
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    if (isMysqlDuplicateEntryError(err)) {
      return {
        success: false,
        status: 409,
        error: 'INVALID_STATE',
        message: 'This request already has a conversation or has already been handled.',
      };
    }
    console.error('Failed to respond to connection request:', err);
    return {
      success: false,
      status: 500,
      error: 'SERVER_ERROR',
      message: 'Failed to process connection response.',
    };
  } finally {
    conn.release();
  }
}

export async function withdrawConnectionRequest(
  userId: number,
  requestId: number,
  reason?: unknown,
): Promise<{ success: true; request: ConnectionRequestItem } | { success: false; status: number; error: string; message: string }> {
  const reasonCheck = validateBoundedText(reason, {
    required: false,
    maxLength: 255,
    label: 'Withdrawal reason',
    emptyError: 'INVALID_REASON',
    typeError: 'INVALID_REASON',
    lengthError: 'REASON_TOO_LONG',
  });
  if (!reasonCheck.ok) {
    return { success: false, status: 400, error: reasonCheck.error, message: reasonCheck.message };
  }

  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT request_id AS requestId, investor_user_id AS investorUserId,
              request_status AS requestStatus
       FROM connection_request WHERE request_id = ? FOR UPDATE`,
      [requestId],
    );
    if (rows.length === 0) {
      await conn.rollback();
      return { success: false, status: 404, error: 'REQUEST_NOT_FOUND', message: 'Connection request not found.' };
    }
    const row = rows[0];
    if (Number(row.investorUserId) !== Number(userId)) {
      await conn.rollback();
      return { success: false, status: 403, error: 'UNAUTHORIZED_REQUESTER', message: 'Only the investor who sent this request can withdraw it.' };
    }
    if (row.requestStatus !== 'PENDING') {
      await conn.rollback();
      return { success: false, status: 409, error: 'INVALID_STATE', message: `Only pending requests can be withdrawn; current state is ${row.requestStatus}.` };
    }

    const [updated] = await conn.execute<ResultSetHeader>(
      `UPDATE connection_request
       SET request_status = 'WITHDRAWN', withdrawn_at = CURRENT_TIMESTAMP,
           status_reason = ?
       WHERE request_id = ? AND request_status = 'PENDING'`,
      [reasonCheck.value || 'withdrawn by investor', requestId],
    );
    if (updated.affectedRows !== 1) {
      await conn.rollback();
      return { success: false, status: 409, error: 'INVALID_STATE', message: 'The request was already handled. Refresh and try again.' };
    }
    await conn.commit();
    const request = await getConnectionRequestById(requestId);
    if (!request) return { success: false, status: 500, error: 'SERVER_ERROR', message: 'Request was withdrawn but could not be reloaded.' };
    return { success: true, request };
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    console.error('Failed to withdraw connection request:', err);
    return { success: false, status: 500, error: 'SERVER_ERROR', message: 'Failed to withdraw connection request.' };
  } finally {
    conn.release();
  }
}

export async function endConnection(
  userId: number,
  requestId: number,
): Promise<{ success: true; request: ConnectionRequestItem } | { success: false; status: number; error: string; message: string }> {
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the request and re-check its state in this transaction. A concurrent
    // end operation will wait here and then observe that the request is no longer ACCEPTED.
    const [requestRows] = await conn.execute<RowDataPacket[]>(
      `SELECT
         request_id AS requestId,
         investor_user_id AS investorUserId,
         founder_user_id AS founderUserId,
         request_status AS requestStatus
       FROM connection_request
       WHERE request_id = ?
       FOR UPDATE`,
      [requestId],
    );

    if (requestRows.length === 0) {
      await conn.rollback();
      return {
        success: false,
        status: 404,
        error: 'REQUEST_NOT_FOUND',
        message: 'Connection not found.',
      };
    }

    const request = requestRows[0];
    if (Number(request.investorUserId) !== Number(userId) && Number(request.founderUserId) !== Number(userId)) {
      await conn.rollback();
      return {
        success: false,
        status: 403,
        error: 'UNAUTHORIZED_PARTICIPANT',
        message: 'You are not a participant in this connection.',
      };
    }

    if (request.requestStatus !== 'ACCEPTED') {
      await conn.rollback();
      return {
        success: false,
        status: 400,
        error: 'NOT_ACTIVE',
        message: 'Only active accepted connections can be ended.',
      };
    }

    const [requestUpdate] = await conn.execute<ResultSetHeader>(
      `UPDATE connection_request
       SET request_status = 'ENDED',
           ended_at = CURRENT_TIMESTAMP
       WHERE request_id = ? AND request_status = 'ACCEPTED'`,
      [requestId],
    );
    if (requestUpdate.affectedRows !== 1) {
      await conn.rollback();
      return {
        success: false,
        status: 409,
        error: 'NOT_ACTIVE',
        message: 'This connection has already ended. Refresh the connections list.',
      };
    }

    // Updating the conversation in the same transaction serializes with sendChatMessage,
    // which locks this conversation row before checking its status and inserting a message.
    const [conversationUpdate] = await conn.execute<ResultSetHeader>(
      `UPDATE conversation
       SET conversation_status = 'READ_ONLY',
           closed_at = CURRENT_TIMESTAMP
       WHERE request_id = ? AND conversation_status = 'OPEN'`,
      [requestId],
    );
    if (conversationUpdate.affectedRows !== 1) {
      await conn.rollback();
      return {
        success: false,
        status: 409,
        error: 'CONVERSATION_NOT_OPEN',
        message: 'The conversation is missing or has already been closed. No connection changes were saved.',
      };
    }

    await conn.commit();

    const updatedRequest = await getConnectionRequestById(requestId);
    if (!updatedRequest) {
      return {
        success: false,
        status: 500,
        error: 'SERVER_ERROR',
        message: 'The connection was ended, but its current state could not be retrieved.',
      };
    }

    return { success: true, request: updatedRequest };
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    console.error('Failed to end connection:', err);
    return {
      success: false,
      status: 500,
      error: 'SERVER_ERROR',
      message: 'Failed to end connection.',
    };
  } finally {
    conn.release();
  }
}

export interface ChatMessageItem {
  messageId: number;
  conversationId: number;
  senderUserId: number;
  senderName: string;
  senderRole: 'FOUNDER' | 'INVESTOR';
  messageBody: string;
  createdAt: string;
}

export interface ConversationDetail {
  conversationId: number;
  requestId: number;
  conversationStatus: 'OPEN' | 'READ_ONLY';
  createdAt: string;
  closedAt: string | null;
  brandName: string;
  counterpartUserId: number;
  counterpartName: string;
  counterpartRole: 'FOUNDER' | 'INVESTOR';
  messages: ChatMessageItem[];
}

export async function getConversationMessages(
  userId: number,
  conversationId: number,
): Promise<{ success: true; conversation: ConversationDetail } | { success: false; status: number; error: string; message: string }> {
  // 1. Lookup conversation and verify participant authorization
  const [convRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
       c.conversation_id AS conversationId,
       c.request_id AS requestId,
       c.conversation_status AS conversationStatus,
       c.created_at AS createdAt,
       c.closed_at AS closedAt,
       comp.brand_name AS brandName,
       cr.investor_user_id AS investorUserId,
       iu.full_name AS investorName,
       cr.founder_user_id AS founderUserId,
       fu.full_name AS founderName
     FROM conversation c
     INNER JOIN connection_request cr ON cr.request_id = c.request_id
     INNER JOIN pitch p ON p.pitch_id = cr.pitch_id
     INNER JOIN company comp ON comp.company_id = p.company_id
     INNER JOIN app_user iu ON iu.user_id = cr.investor_user_id
     INNER JOIN app_user fu ON fu.user_id = cr.founder_user_id
     WHERE c.conversation_id = ?`,
    [conversationId],
  );

  if (convRows.length === 0) {
    return {
      success: false,
      status: 404,
      error: 'CONVERSATION_NOT_FOUND',
      message: 'Conversation not found.',
    };
  }

  const row = convRows[0];
  const isInvestor = row.investorUserId === userId;
  const isFounder = row.founderUserId === userId;

  if (!isInvestor && !isFounder) {
    return {
      success: false,
      status: 403,
      error: 'UNAUTHORIZED_CONVERSATION_ACCESS',
      message: 'You are not an authorized participant in this conversation.',
    };
  }

  // 2. Fetch messages in chronological order
  const [messageRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
       m.message_id AS messageId,
       m.conversation_id AS conversationId,
       m.sender_user_id AS senderUserId,
       u.full_name AS senderName,
       CASE WHEN m.sender_user_id = ? THEN 'INVESTOR' ELSE 'FOUNDER' END AS senderRole,
       m.message_body AS messageBody,
       m.created_at AS createdAt
     FROM message m
     INNER JOIN app_user u ON u.user_id = m.sender_user_id
     WHERE m.conversation_id = ?
     ORDER BY m.created_at ASC, m.message_id ASC`,
    [row.investorUserId, conversationId],
  );

  const counterpartUserId = isInvestor ? row.founderUserId : row.investorUserId;
  const counterpartName = isInvestor ? row.founderName : row.investorName;
  const counterpartRole: 'FOUNDER' | 'INVESTOR' = isInvestor ? 'FOUNDER' : 'INVESTOR';

  return {
    success: true,
    conversation: {
      conversationId: row.conversationId,
      requestId: row.requestId,
      conversationStatus: row.conversationStatus,
      createdAt: row.createdAt,
      closedAt: row.closedAt,
      brandName: row.brandName,
      counterpartUserId,
      counterpartName,
      counterpartRole,
      messages: messageRows as ChatMessageItem[],
    },
  };
}

export async function sendChatMessage(
  userId: number,
  conversationId: number,
  messageBody: unknown,
): Promise<{ success: true; message: ChatMessageItem } | { success: false; status: number; error: string; message: string }> {
  const bodyCheck = validateBoundedText(messageBody, {
    required: true,
    maxLength: MAX_CHAT_MESSAGE_LENGTH,
    label: 'Message body',
    emptyError: 'EMPTY_MESSAGE',
  });
  if (!bodyCheck.ok || bodyCheck.value === null) {
    return {
      success: false,
      status: 400,
      error: bodyCheck.ok ? 'EMPTY_MESSAGE' : bodyCheck.error,
      message: bodyCheck.ok ? 'Message body cannot be empty.' : bodyCheck.message,
    };
  }
  const trimmed = bodyCheck.value;

  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    // This row lock is shared with endConnection's conversation status update.
    // Consequently a send either commits before ending, or sees READ_ONLY afterwards.
    const [conversationRows] = await conn.execute<RowDataPacket[]>(
      `SELECT conversation_id AS conversationId,
              request_id AS requestId,
              conversation_status AS conversationStatus
       FROM conversation
       WHERE conversation_id = ?
       FOR UPDATE`,
      [conversationId],
    );

    if (conversationRows.length === 0) {
      await conn.rollback();
      return {
        success: false,
        status: 404,
        error: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found.',
      };
    }

    const conversation = conversationRows[0];
    const [requestRows] = await conn.execute<RowDataPacket[]>(
      `SELECT investor_user_id AS investorUserId,
              founder_user_id AS founderUserId
       FROM connection_request
       WHERE request_id = ?`,
      [conversation.requestId],
    );

    if (requestRows.length === 0) {
      await conn.rollback();
      return {
        success: false,
        status: 404,
        error: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found.',
      };
    }

    const request = requestRows[0];
    const isInvestor = Number(request.investorUserId) === Number(userId);
    const isFounder = Number(request.founderUserId) === Number(userId);
    if (!isInvestor && !isFounder) {
      await conn.rollback();
      return {
        success: false,
        status: 403,
        error: 'UNAUTHORIZED_SENDER',
        message: 'You are not a participant in this conversation.',
      };
    }

    if (conversation.conversationStatus !== 'OPEN') {
      await conn.rollback();
      return {
        success: false,
        status: 403,
        error: 'CONVERSATION_READ_ONLY',
        message: 'This connection has ended. Conversation is preserved in read-only mode and new messages cannot be sent.',
      };
    }

    const [insertResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO message (conversation_id, sender_user_id, message_body, created_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [conversationId, userId, trimmed],
    );

    const [userRows] = await conn.execute<RowDataPacket[]>(
      `SELECT full_name FROM app_user WHERE user_id = ?`,
      [userId],
    );

    await conn.commit();

    return {
      success: true,
      message: {
        messageId: insertResult.insertId,
        conversationId,
        senderUserId: userId,
        senderName: userRows[0]?.full_name || 'User',
        senderRole: isInvestor ? 'INVESTOR' : 'FOUNDER',
        messageBody: trimmed,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    console.error('Failed to send chat message:', err);
    return {
      success: false,
      status: 500,
      error: 'SERVER_ERROR',
      message: 'Failed to send message.',
    };
  } finally {
    conn.release();
  }
}
