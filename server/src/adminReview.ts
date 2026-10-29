import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { parsePagination } from './validation.js';

export const MIN_REJECTION_NOTE_LENGTH = 10;
export const MAX_REVIEW_NOTE_LENGTH = 2000;

export type AdminReviewDecision = 'PUBLISH' | 'REJECT';
export type ReviewablePitchStatus = 'DRAFT' | 'SUBMITTED' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';

export interface ParsedReviewDecision {
  decision: AdminReviewDecision;
  note: string | null;
}

export type InputValidationResult =
  | { ok: true; value: ParsedReviewDecision }
  | { ok: false; status: 400; error: string; message: string };

export interface RoleAccessResult {
  allowed: boolean;
  status?: 401 | 403;
  error?: 'UNAUTHORIZED' | 'FORBIDDEN';
}

/** Shared role decision used by the request guard and tested without a database. */
export function evaluateRoleAccess(
  authenticated: boolean,
  roles: readonly string[] = [],
  allowedRoles?: readonly string[],
): RoleAccessResult {
  if (!authenticated) return { allowed: false, status: 401, error: 'UNAUTHORIZED' };
  if (allowedRoles?.length && !allowedRoles.some((role) => roles.includes(role))) {
    return { allowed: false, status: 403, error: 'FORBIDDEN' };
  }
  return { allowed: true };
}

export function parseReviewDecisionInput(input: unknown): InputValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, status: 400, error: 'INVALID_REVIEW_INPUT', message: 'A review decision object is required.' };
  }

  const body = input as Record<string, unknown>;
  if (body.decision !== 'PUBLISH' && body.decision !== 'REJECT') {
    return { ok: false, status: 400, error: 'INVALID_REVIEW_DECISION', message: "Decision must be 'PUBLISH' or 'REJECT'." };
  }

  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') {
      return { ok: false, status: 400, error: 'INVALID_REVIEW_NOTE', message: 'Review note must be text.' };
    }
    const trimmed = body.note.trim();
    if (trimmed.length > MAX_REVIEW_NOTE_LENGTH) {
      return { ok: false, status: 400, error: 'REVIEW_NOTE_TOO_LONG', message: `Review notes must be ${MAX_REVIEW_NOTE_LENGTH} characters or fewer.` };
    }
    note = trimmed || null;
  }

  if (body.decision === 'REJECT' && (!note || note.length < MIN_REJECTION_NOTE_LENGTH)) {
    return {
      ok: false,
      status: 400,
      error: 'REJECTION_NOTE_REQUIRED',
      message: `A rejection note of at least ${MIN_REJECTION_NOTE_LENGTH} non-space characters is required.`,
    };
  }

  return { ok: true, value: { decision: body.decision, note } };
}

export interface ReviewTransitionResult {
  ok: boolean;
  status?: 404 | 409;
  error?: 'PITCH_NOT_FOUND' | 'SHOW_PITCH_IMMUTABLE' | 'PITCH_NOT_REVIEWABLE';
  message?: string;
  nextStatus?: 'PUBLISHED' | 'REJECTED';
}

/** Pure transition guard. The SQL transaction repeats the checks while holding a row lock. */
export function resolveReviewTransition(
  pitchType: string,
  pitchStatus: string,
  decision: AdminReviewDecision,
): ReviewTransitionResult {
  if (pitchType !== 'PLATFORM') {
    return {
      ok: false,
      status: 409,
      error: 'SHOW_PITCH_IMMUTABLE',
      message: 'Historical Shark Tank pitches cannot be reviewed or changed through the platform review workflow.',
    };
  }
  if (pitchStatus !== 'SUBMITTED') {
    return {
      ok: false,
      status: 409,
      error: 'PITCH_NOT_REVIEWABLE',
      message: 'Only submitted platform pitches can receive a review decision. Reload the queue to see the current status.',
    };
  }
  return { ok: true, nextStatus: decision === 'PUBLISH' ? 'PUBLISHED' : 'REJECTED' };
}

export class AdminReviewError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AdminReviewError';
  }
}

export interface AdminReviewPitch extends RowDataPacket {
  pitchId: number;
  companyId: number;
  brandName: string;
  legalBusinessName: string | null;
  businessModel: string | null;
  websiteUrl: string | null;
  foundedYear: number | null;
  headquartersCity: string | null;
  headquartersState: string | null;
  headquartersCountry: string | null;
  industryName: string | null;
  stageName: string | null;
  originalAskAmount: number | string | null;
  originalAskEquityPct: number | string | null;
  pitchHook: string | null;
  pitchStatus: ReviewablePitchStatus;
  submittedAt: string;
  founderUserId: number;
  founderName: string;
}

export interface ReviewHistoryItem extends RowDataPacket {
  reviewEventId: number;
  pitchId: number;
  decision: AdminReviewDecision;
  reviewNote: string | null;
  decidedAt: string;
  reviewerUserId: number;
  reviewerName: string;
}

interface PitchStatusRow extends RowDataPacket {
  pitchType: string;
  pitchStatus: string;
}

interface OwnerRow extends RowDataPacket {
  pitchType: string;
  submittedByUserId: number | null;
}

/** Ownership policy for founder-visible review history. */
export function founderMayReadPitchReviewHistory(
  authenticatedFounderUserId: number,
  pitchType: string,
  submittedByUserId: number | null,
): boolean {
  return pitchType === 'PLATFORM' && submittedByUserId !== null && Number(submittedByUserId) === authenticatedFounderUserId;
}

const PITCH_COLUMNS = `
  SELECT
    p.pitch_id AS pitchId,
    p.company_id AS companyId,
    c.brand_name AS brandName,
    c.legal_business_name AS legalBusinessName,
    c.business_model AS businessModel,
    c.website_url AS websiteUrl,
    c.founded_year AS foundedYear,
    c.headquarters_city AS headquartersCity,
    c.headquarters_state AS headquartersState,
    c.headquarters_country AS headquartersCountry,
    i.industry_name AS industryName,
    st.stage_name AS stageName,
    p.original_ask_amount AS originalAskAmount,
    p.original_ask_equity_pct AS originalAskEquityPct,
    p.pitch_hook AS pitchHook,
    p.pitch_status AS pitchStatus,
    p.submitted_at AS submittedAt,
    p.submitted_by_user_id AS founderUserId,
    u.full_name AS founderName
  FROM pitch p
  INNER JOIN company c ON c.company_id = p.company_id
  LEFT JOIN industry i ON i.industry_id = c.industry_id
  LEFT JOIN startup_stage st ON st.stage_id = c.stage_id
  INNER JOIN app_user u ON u.user_id = p.submitted_by_user_id`;

const HISTORY_QUERY = `
  SELECT
    e.review_event_id AS reviewEventId,
    e.pitch_id AS pitchId,
    e.decision,
    e.review_note AS reviewNote,
    e.decided_at AS decidedAt,
    e.reviewer_user_id AS reviewerUserId,
    reviewer.full_name AS reviewerName
  FROM pitch_review_event e
  INNER JOIN app_user reviewer ON reviewer.user_id = e.reviewer_user_id`;

export async function getAdminReviewQueue(
  pool: Pool,
  pagination?: { limit?: unknown; offset?: unknown },
): Promise<AdminReviewPitch[]> {
  let limitClause = '';
  const params: number[] = [];

  if (pagination && (pagination.limit !== undefined || pagination.offset !== undefined)) {
    const { limit, offset } = parsePagination(pagination as Record<string, unknown>, {
      defaultLimit: 50,
      maxLimit: 100,
    });
    limitClause = ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  const [rows] = await pool.execute<AdminReviewPitch[]>(
    `${PITCH_COLUMNS}
     WHERE p.pitch_type = 'PLATFORM' AND p.pitch_status = 'SUBMITTED'
     ORDER BY p.submitted_at ASC, p.pitch_id ASC${limitClause}`,
    params,
  );
  return rows;
}

function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: unknown; errno?: unknown; message?: unknown };
  return (
    e.code === 'ER_NO_SUCH_TABLE' ||
    e.errno === 1146 ||
    (typeof e.message === 'string' &&
      e.message.includes('pitch_review_event') &&
      e.message.includes("doesn't exist"))
  );
}

export async function getAdminReviewDetail(pool: Pool, pitchId: number): Promise<{
  pitch: AdminReviewPitch;
  history: ReviewHistoryItem[];
}> {
  const [pitchRows] = await pool.execute<AdminReviewPitch[]>(
    `${PITCH_COLUMNS}
     WHERE p.pitch_type = 'PLATFORM' AND p.pitch_id = ?
     LIMIT 1`,
    [pitchId],
  );
  const pitch = pitchRows[0];
  if (!pitch) throw new AdminReviewError(404, 'PITCH_NOT_FOUND', 'Platform pitch was not found.');

  let history: ReviewHistoryItem[] = [];
  try {
    const [historyRows] = await pool.execute<ReviewHistoryItem[]>(
      `${HISTORY_QUERY}
       WHERE e.pitch_id = ?
       ORDER BY e.decided_at ASC, e.review_event_id ASC`,
      [pitchId],
    );
    history = historyRows;
  } catch (error) {
    if (isTableMissingError(error)) {
      history = [];
    } else {
      throw error;
    }
  }
  return { pitch, history };
}

export async function decideAdminReview(
  pool: Pool,
  pitchId: number,
  reviewerUserId: number,
  decision: ParsedReviewDecision,
): Promise<{ pitchId: number; pitchStatus: 'PUBLISHED' | 'REJECTED'; decidedAt: string }> {
  const connection: PoolConnection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<PitchStatusRow[]>(
      `SELECT pitch_type AS pitchType, pitch_status AS pitchStatus
       FROM pitch WHERE pitch_id = ? FOR UPDATE`,
      [pitchId],
    );
    const current = rows[0];
    if (!current) throw new AdminReviewError(404, 'PITCH_NOT_FOUND', 'Platform pitch was not found.');

    const transition = resolveReviewTransition(current.pitchType, current.pitchStatus, decision.decision);
    if (!transition.ok || !transition.nextStatus) {
      throw new AdminReviewError(transition.status ?? 409, transition.error ?? 'PITCH_NOT_REVIEWABLE', transition.message ?? 'Pitch cannot be reviewed.');
    }

    const [updated] = await connection.execute<ResultSetHeader>(
      `UPDATE pitch
       SET pitch_status = ?
       WHERE pitch_id = ? AND pitch_type = 'PLATFORM' AND pitch_status = 'SUBMITTED'`,
      [transition.nextStatus, pitchId],
    );
    if (updated.affectedRows !== 1) {
      throw new AdminReviewError(409, 'PITCH_NOT_REVIEWABLE', 'The pitch changed while it was being reviewed. Reload the queue and try again.');
    }

    let decidedAtValue: string | undefined;
    try {
      const [insertResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO pitch_review_event
           (pitch_id, reviewer_user_id, decision, review_note)
         VALUES (?, ?, ?, ?)`,
        [pitchId, reviewerUserId, decision.decision, decision.note],
      );
      const [eventRows] = await connection.execute<RowDataPacket[]>(
        'SELECT decided_at AS decidedAt FROM pitch_review_event WHERE review_event_id = ? LIMIT 1',
        [insertResult.insertId],
      );
      decidedAtValue = eventRows[0]?.decidedAt;
    } catch (error) {
      if (isTableMissingError(error)) {
        // Table pitch_review_event is unapplied while migration 004 is DRAFT; pitch status was safely updated.
      } else {
        throw error;
      }
    }

    await connection.commit();
    return {
      pitchId,
      pitchStatus: transition.nextStatus,
      decidedAt: decidedAtValue ? new Date(decidedAtValue).toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function getFounderPitchReviewHistory(
  pool: Pool,
  founderUserId: number,
  pitchId: number,
): Promise<ReviewHistoryItem[]> {
  const [ownerRows] = await pool.execute<OwnerRow[]>(
    `SELECT pitch_type AS pitchType, submitted_by_user_id AS submittedByUserId
     FROM pitch WHERE pitch_id = ? LIMIT 1`,
    [pitchId],
  );
  const owner = ownerRows[0];
  // Return the same not-found response for nonexistent, SHOW, and non-owned records to avoid disclosure.
  if (!owner || !founderMayReadPitchReviewHistory(founderUserId, owner.pitchType, owner.submittedByUserId === null ? null : Number(owner.submittedByUserId))) {
    throw new AdminReviewError(404, 'PITCH_NOT_FOUND', 'Pitch review history was not found.');
  }

  let history: ReviewHistoryItem[] = [];
  try {
    const [historyRows] = await pool.execute<ReviewHistoryItem[]>(
      `${HISTORY_QUERY}
       WHERE e.pitch_id = ?
       ORDER BY e.decided_at ASC, e.review_event_id ASC`,
      [pitchId],
    );
    history = historyRows;
  } catch (error) {
    if (isTableMissingError(error)) {
      history = [];
    } else {
      throw error;
    }
  }
  return history;
}
