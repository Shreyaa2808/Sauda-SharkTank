import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { dbPool } from './db.js';

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

  let orderBy = 'p.submitted_at DESC, p.pitch_id DESC';
  if (filters.sortBy === 'ask_asc') {
    orderBy = 'p.original_ask_amount ASC';
  } else if (filters.sortBy === 'ask_desc') {
    orderBy = 'p.original_ask_amount DESC';
  } else if (filters.sortBy === 'brand_name') {
    orderBy = 'c.brand_name ASC';
  }

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
): Promise<{ saved: boolean }> {
  const [existing] = await dbPool.execute<RowDataPacket[]>(
    `SELECT 1 FROM user_saved_pitch WHERE user_id = ? AND pitch_id = ?`,
    [userId, pitchId],
  );

  if (existing.length > 0) {
    await dbPool.execute(`DELETE FROM user_saved_pitch WHERE user_id = ? AND pitch_id = ?`, [userId, pitchId]);
    return { saved: false };
  } else {
    await dbPool.execute(
      `INSERT INTO user_saved_pitch (user_id, pitch_id, saved_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [userId, pitchId],
    );
    return { saved: true };
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
  investorEmail: string;
  investorFirmName: string | null;
  founderUserId: number;
  founderName: string;
  founderEmail: string;
  requestStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'ENDED';
  initialMessage: string | null;
  statusReason: string | null;
  createdAt: string;
  respondedAt: string | null;
  endedAt: string | null;
  conversationId: number | null;
  conversationStatus: 'OPEN' | 'READ_ONLY' | null;
}

export async function createConnectionRequest(
  investorUserId: number,
  pitchId: number,
  initialMessage?: string,
): Promise<{ success: true; requestId: number; request: ConnectionRequestItem } | { success: false; status: number; error: string; message: string }> {
  // 1. Verify pitch existence and publication
  const [pitchRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT p.pitch_id, p.pitch_type, p.pitch_status, p.submitted_by_user_id, c.brand_name
     FROM pitch p
     INNER JOIN company c ON c.company_id = p.company_id
     WHERE p.pitch_id = ?`,
    [pitchId],
  );

  if (pitchRows.length === 0) {
    return {
      success: false,
      status: 404,
      error: 'PITCH_NOT_FOUND',
      message: 'Pitch listing not found.',
    };
  }

  const pitch = pitchRows[0];

  if (pitch.pitch_type !== 'PLATFORM') {
    return {
      success: false,
      status: 400,
      error: 'PLATFORM_ONLY',
      message: 'Connection requests can only be initiated for registered Platform venture listings.',
    };
  }

  if (pitch.pitch_status !== 'PUBLISHED') {
    return {
      success: false,
      status: 400,
      error: 'PITCH_NOT_PUBLISHED',
      message: 'Connection requests can only be sent to published listings.',
    };
  }

  const founderUserId = Number(pitch.submitted_by_user_id);

  // Security check: distinct parties
  if (investorUserId === founderUserId) {
    return {
      success: false,
      status: 400,
      error: 'SELF_CONNECTION_FORBIDDEN',
      message: 'You cannot initiate a connection request with your own venture.',
    };
  }

  // 2. Ensure linked records exist in founder and investor tables to satisfy foreign keys
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    // Check investor record
    const [invRows] = await conn.execute<RowDataPacket[]>(
      `SELECT user_id FROM investor WHERE user_id = ?`,
      [investorUserId],
    );
    if (invRows.length === 0) {
      const [uRows] = await conn.execute<RowDataPacket[]>(
        `SELECT full_name FROM app_user WHERE user_id = ?`,
        [investorUserId],
      );
      const nameParts = (uRows[0]?.full_name || 'Investor').trim().split(/\s+/);
      await conn.execute(
        `INSERT INTO investor (user_id, first_name, last_name, display_name)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
        [investorUserId, nameParts[0], nameParts.slice(1).join(' ') || 'Investor', uRows[0]?.full_name],
      );
    }

    // Check founder record
    const [fdrRows] = await conn.execute<RowDataPacket[]>(
      `SELECT user_id FROM founder WHERE user_id = ?`,
      [founderUserId],
    );
    if (fdrRows.length === 0) {
      const [uRows] = await conn.execute<RowDataPacket[]>(
        `SELECT full_name, email FROM app_user WHERE user_id = ?`,
        [founderUserId],
      );
      const nameParts = (uRows[0]?.full_name || 'Founder').trim().split(/\s+/);
      await conn.execute(
        `INSERT INTO founder (user_id, first_name, last_name, email)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE first_name = VALUES(first_name)`,
        [founderUserId, nameParts[0], nameParts.slice(1).join(' ') || 'Founder', uRows[0]?.email],
      );
    }

    // Check for existing active request
    const [existingActive] = await conn.execute<RowDataPacket[]>(
      `SELECT request_id, request_status
       FROM connection_request
       WHERE investor_user_id = ? AND founder_user_id = ? AND request_status IN ('PENDING', 'ACCEPTED')`,
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

    const cleanMessage = initialMessage?.trim() || null;

    // Insert connection request
    const [insertResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO connection_request (
         pitch_id,
         investor_user_id,
         founder_user_id,
         request_status,
         initial_message,
         created_at
       ) VALUES (?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP)`,
      [pitchId, investorUserId, founderUserId, cleanMessage],
    );

    const requestId = insertResult.insertId;

    await conn.commit();

    const request = await getConnectionRequestById(requestId);
    if (!request) {
      throw new Error('Could not retrieve created connection request');
    }

    return {
      success: true,
      requestId,
      request,
    };
  } catch (err) {
    await conn.rollback();
    console.error('Failed to create connection request:', err);
    return {
      success: false,
      status: 500,
      error: 'SERVER_ERROR',
      message: 'Failed to initiate connection request.',
    };
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
       iu.email AS investorEmail,
       inv.investment_firm_name AS investorFirmName,
       cr.founder_user_id AS founderUserId,
       fu.full_name AS founderName,
       fu.email AS founderEmail,
       cr.request_status AS requestStatus,
       cr.initial_message AS initialMessage,
       cr.status_reason AS statusReason,
       cr.created_at AS createdAt,
       cr.responded_at AS respondedAt,
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
       iu.email AS investorEmail,
       inv.investment_firm_name AS investorFirmName,
       cr.founder_user_id AS founderUserId,
       fu.full_name AS founderName,
       fu.email AS founderEmail,
       cr.request_status AS requestStatus,
       cr.initial_message AS initialMessage,
       cr.status_reason AS statusReason,
       cr.created_at AS createdAt,
       cr.responded_at AS respondedAt,
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
  const req = await getConnectionRequestById(requestId);
  if (!req) {
    return {
      success: false,
      status: 404,
      error: 'REQUEST_NOT_FOUND',
      message: 'Connection request not found.',
    };
  }

  // Security check: Only the recipient founder can accept or decline
  if (req.founderUserId !== userId) {
    return {
      success: false,
      status: 403,
      error: 'UNAUTHORIZED_RECIPIENT',
      message: 'Only the recipient founder of this connection request can respond to it.',
    };
  }

  if (req.requestStatus !== 'PENDING') {
    return {
      success: false,
      status: 400,
      error: 'INVALID_STATE',
      message: `Cannot respond to a request with status ${req.requestStatus}.`,
    };
  }

  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    if (action === 'ACCEPT') {
      // 1. Update request status to ACCEPTED
      await conn.execute(
        `UPDATE connection_request
         SET request_status = 'ACCEPTED',
             responded_at = CURRENT_TIMESTAMP
         WHERE request_id = ?`,
        [requestId],
      );

      // 2. Open conversation
      const [convRes] = await conn.execute<ResultSetHeader>(
        `INSERT INTO conversation (request_id, conversation_status, created_at)
         VALUES (?, 'OPEN', CURRENT_TIMESTAMP)`,
        [requestId],
      );

      const conversationId = convRes.insertId;

      // 3. If there was an initial message, record it in the message table
      if (req.initialMessage && req.initialMessage.trim()) {
        await conn.execute(
          `INSERT INTO message (conversation_id, sender_user_id, message_body, created_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          [conversationId, req.investorUserId, req.initialMessage.trim()],
        );
      }
    } else {
      // Decline request
      await conn.execute(
        `UPDATE connection_request
         SET request_status = 'DECLINED',
             responded_at = CURRENT_TIMESTAMP,
             status_reason = ?
         WHERE request_id = ?`,
        [reason?.trim() || null, requestId],
      );
    }

    await conn.commit();

    const updated = await getConnectionRequestById(requestId);
    return {
      success: true,
      request: updated!,
    };
  } catch (err) {
    await conn.rollback();
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

export async function endConnection(
  userId: number,
  requestId: number,
): Promise<{ success: true; request: ConnectionRequestItem } | { success: false; status: number; error: string; message: string }> {
  const req = await getConnectionRequestById(requestId);
  if (!req) {
    return {
      success: false,
      status: 404,
      error: 'REQUEST_NOT_FOUND',
      message: 'Connection not found.',
    };
  }

  // Security check: Must be one of the two participants
  if (req.investorUserId !== userId && req.founderUserId !== userId) {
    return {
      success: false,
      status: 403,
      error: 'UNAUTHORIZED_PARTICIPANT',
      message: 'You are not a participant in this connection.',
    };
  }

  if (req.requestStatus !== 'ACCEPTED') {
    return {
      success: false,
      status: 400,
      error: 'NOT_ACTIVE',
      message: 'Only active accepted connections can be ended.',
    };
  }

  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Update connection_request to ENDED with ended_at
    await conn.execute(
      `UPDATE connection_request
       SET request_status = 'ENDED',
           ended_at = CURRENT_TIMESTAMP
       WHERE request_id = ?`,
      [requestId],
    );

    // 2. Update conversation to READ_ONLY with closed_at
    await conn.execute(
      `UPDATE conversation
       SET conversation_status = 'READ_ONLY',
           closed_at = CURRENT_TIMESTAMP
       WHERE request_id = ?`,
      [requestId],
    );

    await conn.commit();

    const updated = await getConnectionRequestById(requestId);
    return {
      success: true,
      request: updated!,
    };
  } catch (err) {
    await conn.rollback();
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
  counterpartEmail: string;
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
       iu.email AS investorEmail,
       cr.founder_user_id AS founderUserId,
       fu.full_name AS founderName,
       fu.email AS founderEmail
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
  const counterpartEmail = isInvestor ? row.founderEmail : row.investorEmail;
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
      counterpartEmail,
      counterpartRole,
      messages: messageRows as ChatMessageItem[],
    },
  };
}

export async function sendChatMessage(
  userId: number,
  conversationId: number,
  messageBody: string,
): Promise<{ success: true; message: ChatMessageItem } | { success: false; status: number; error: string; message: string }> {
  const trimmed = (messageBody || '').trim();
  if (!trimmed) {
    return {
      success: false,
      status: 400,
      error: 'EMPTY_MESSAGE',
      message: 'Message body cannot be empty.',
    };
  }

  // Lookup conversation and verify participant authorization
  const [convRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT
       c.conversation_id AS conversationId,
       c.conversation_status AS conversationStatus,
       cr.investor_user_id AS investorUserId,
       cr.founder_user_id AS founderUserId
     FROM conversation c
     INNER JOIN connection_request cr ON cr.request_id = c.request_id
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
      error: 'UNAUTHORIZED_SENDER',
      message: 'You are not a participant in this conversation.',
    };
  }

  // Security check: cannot send message in ended/read-only conversation
  if (row.conversationStatus === 'READ_ONLY') {
    return {
      success: false,
      status: 403,
      error: 'CONVERSATION_READ_ONLY',
      message: 'This connection has ended. Conversation is preserved in read-only mode and new messages cannot be sent.',
    };
  }

  const [insertResult] = await dbPool.execute<ResultSetHeader>(
    `INSERT INTO message (conversation_id, sender_user_id, message_body, created_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    [conversationId, userId, trimmed],
  );

  const messageId = insertResult.insertId;

  // Retrieve user name
  const [userRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT full_name FROM app_user WHERE user_id = ?`,
    [userId],
  );

  return {
    success: true,
    message: {
      messageId,
      conversationId,
      senderUserId: userId,
      senderName: userRows[0]?.full_name || 'User',
      senderRole: isInvestor ? 'INVESTOR' : 'FOUNDER',
      messageBody: trimmed,
      createdAt: new Date().toISOString(),
    },
  };
}
