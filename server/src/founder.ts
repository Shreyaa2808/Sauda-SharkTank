import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { dbPool } from './db.js';

// ============================================================================
// FOUNDER WORKSPACE
// ----------------------------------------------------------------------------
// Ownership rule: for a PLATFORM pitch, pitch.submitted_by_user_id is the
// authoritative owner. Historical SHOW pitches are immutable.
//
// Status lifecycle enforced for founders (founders can never set PUBLISHED,
// REJECTED or ARCHIVED through update; ARCHIVED is reached only via
// archiveFounderPitch):
//
//   DRAFT      -> DRAFT | SUBMITTED
//   SUBMITTED  -> DRAFT (withdraw)           [content is locked while in review]
//   REJECTED   -> DRAFT | SUBMITTED          [edit and resubmit]
//   PUBLISHED  -> locked (409)
//   ARCHIVED   -> locked (409)
// ============================================================================

export type PitchStatus = 'DRAFT' | 'SUBMITTED' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';

export interface FounderPitch {
  pitchId: number;
  companyId: number;
  pitchType: 'SHOW' | 'PLATFORM';
  pitchStatus: PitchStatus;
  brandName: string;
  legalBusinessName: string | null;
  businessModel: string | null;
  websiteUrl: string | null;
  foundedYear: number | null;
  headquartersCity: string | null;
  headquartersState: string | null;
  headquartersCountry: string | null;
  industryId: number;
  industryName: string | null;
  stageId: number | null;
  stageName: string | null;
  originalAskAmount: number | string | null;
  originalAskEquityPct: number | string | null;
  pitchHook: string | null;
  submittedAt: string;
}

export interface FounderMetrics {
  totalCount: number;
  draftCount: number;
  submittedCount: number;
  publishedCount: number;
  rejectedCount: number;
  /** Archived pitches are excluded from totalCount and from the pitches list. */
  archivedCount: number;
}

export interface FounderDashboardData {
  metrics: FounderMetrics;
  pitches: FounderPitch[];
}

export interface CreatePitchPayload {
  brandName: string;
  legalBusinessName?: string | null;
  industryId: number;
  stageId?: number | null;
  businessModel?: string | null;
  websiteUrl?: string | null;
  foundedYear?: number | null;
  headquartersCity?: string | null;
  headquartersState?: string | null;
  headquartersCountry?: string | null;
  pitchHook?: string | null;
  originalAskAmount?: number | null;
  originalAskEquityPct?: number | null;
  pitchStatus: 'DRAFT' | 'SUBMITTED';
}

export interface FounderFailure {
  success: false;
  status: number;
  error: string;
  message: string;
  /** Per-field messages the UI can show next to inputs. */
  fieldErrors?: Record<string, string>;
}

type FounderResult<T> = ({ success: true } & T) | FounderFailure;

// ----------------------------------------------------------------------------
// Validation
// ----------------------------------------------------------------------------

const LIMITS = {
  brandName: 150,
  legalBusinessName: 200,
  businessModel: 100,
  websiteUrl: 500,
  headquartersCity: 100,
  headquartersState: 100,
  headquartersCountry: 100,
  pitchHook: 1000,
} as const;

const MAX_ASK_AMOUNT = 100_000_000_000; // sanity ceiling: INR 10,000 crore

/** Validated field values. A key is present only if the client sent it. */
interface PitchFieldValues {
  brandName?: string;
  legalBusinessName?: string | null;
  industryId?: number;
  stageId?: number | null;
  businessModel?: string | null;
  websiteUrl?: string | null;
  foundedYear?: number | null;
  headquartersCity?: string | null;
  headquartersState?: string | null;
  headquartersCountry?: string | null;
  pitchHook?: string | null;
  originalAskAmount?: number | null;
  originalAskEquityPct?: number | null;
}

type Queryable = Pick<Pool, 'execute'> | Pick<PoolConnection, 'execute'>;

function fail(
  status: number,
  error: string,
  message: string,
  fieldErrors?: Record<string, string>,
): FounderFailure {
  return { success: false, status, error, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBlank(value: unknown): boolean {
  return value === null || (typeof value === 'string' && value.trim() === '');
}

/** Parses a number from a JS number or a numeric string. Returns NaN if invalid. */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

function currentYear(): number {
  return new Date().getFullYear();
}

/**
 * Validates every founder-editable field that is present on the payload.
 * Shared by create and update so both enforce identical rules.
 * Collects all field errors rather than stopping at the first.
 */
async function validatePitchFields(
  payload: Record<string, unknown>,
  db: Queryable,
  opts: { requireBrandAndIndustry: boolean },
): Promise<{ values: PitchFieldValues; fieldErrors: Record<string, string> }> {
  const values: PitchFieldValues = {};
  const errors: Record<string, string> = {};

  // --- brandName (required, never blank) ---
  if (payload.brandName !== undefined) {
    if (typeof payload.brandName !== 'string' || payload.brandName.trim() === '') {
      errors.brandName = 'Venture brand name is required.';
    } else if (payload.brandName.trim().length > LIMITS.brandName) {
      errors.brandName = `Brand name must not exceed ${LIMITS.brandName} characters.`;
    } else {
      values.brandName = payload.brandName.trim();
    }
  } else if (opts.requireBrandAndIndustry) {
    errors.brandName = 'Venture brand name is required.';
  }

  // --- optional text fields ---
  const textFields = [
    'legalBusinessName',
    'businessModel',
    'headquartersCity',
    'headquartersState',
    'headquartersCountry',
    'pitchHook',
  ] as const;
  for (const key of textFields) {
    const raw = payload[key];
    if (raw === undefined) continue;
    if (isBlank(raw)) {
      values[key] = null;
    } else if (typeof raw !== 'string') {
      errors[key] = 'Must be text.';
    } else if (raw.trim().length > LIMITS[key]) {
      errors[key] = `Must not exceed ${LIMITS[key]} characters.`;
    } else {
      values[key] = raw.trim();
    }
  }

  // --- websiteUrl: http/https only ---
  if (payload.websiteUrl !== undefined) {
    if (isBlank(payload.websiteUrl)) {
      values.websiteUrl = null;
    } else if (typeof payload.websiteUrl !== 'string') {
      errors.websiteUrl = 'Website URL must be text.';
    } else {
      const url = payload.websiteUrl.trim();
      let valid = false;
      if (url.length <= LIMITS.websiteUrl) {
        try {
          const parsed = new URL(url);
          valid = parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          valid = false;
        }
      }
      if (!valid) {
        errors.websiteUrl = `Enter a valid http(s) URL (max ${LIMITS.websiteUrl} characters).`;
      } else {
        values.websiteUrl = url;
      }
    }
  }

  // --- foundedYear ---
  if (payload.foundedYear !== undefined) {
    if (isBlank(payload.foundedYear)) {
      values.foundedYear = null;
    } else {
      const year = toNumber(payload.foundedYear);
      if (!Number.isInteger(year) || year < 1900 || year > currentYear()) {
        errors.foundedYear = `Founded year must be a whole year between 1900 and ${currentYear()}.`;
      } else {
        values.foundedYear = year;
      }
    }
  }

  // --- originalAskAmount (0 is a valid number) ---
  if (payload.originalAskAmount !== undefined) {
    if (isBlank(payload.originalAskAmount)) {
      values.originalAskAmount = null;
    } else {
      const amount = toNumber(payload.originalAskAmount);
      if (!Number.isFinite(amount) || amount < 0 || amount > MAX_ASK_AMOUNT) {
        errors.originalAskAmount = 'Investment ask must be a non-negative number within a realistic range.';
      } else {
        values.originalAskAmount = amount;
      }
    }
  }

  // --- originalAskEquityPct ---
  if (payload.originalAskEquityPct !== undefined) {
    if (isBlank(payload.originalAskEquityPct)) {
      values.originalAskEquityPct = null;
    } else {
      const pct = toNumber(payload.originalAskEquityPct);
      if (!Number.isFinite(pct) || pct < 0.01 || pct > 100) {
        errors.originalAskEquityPct = 'Equity offered must be between 0.01% and 100%.';
      } else {
        values.originalAskEquityPct = pct;
      }
    }
  }

  // --- industryId: integer AND must exist ---
  if (payload.industryId !== undefined) {
    const id = toNumber(payload.industryId);
    if (!Number.isInteger(id) || id < 1) {
      errors.industryId = 'A valid industry category is required.';
    } else {
      const [rows] = await db.execute<RowDataPacket[]>(
        'SELECT 1 FROM industry WHERE industry_id = ? LIMIT 1',
        [id],
      );
      if (rows.length === 0) {
        errors.industryId = 'Selected industry does not exist.';
      } else {
        values.industryId = id;
      }
    }
  } else if (opts.requireBrandAndIndustry) {
    errors.industryId = 'A valid industry category is required.';
  }

  // --- stageId: optional, but must exist when provided ---
  if (payload.stageId !== undefined) {
    if (isBlank(payload.stageId) || payload.stageId === 0) {
      values.stageId = null;
    } else {
      const id = toNumber(payload.stageId);
      if (!Number.isInteger(id) || id < 1) {
        errors.stageId = 'Selected stage is invalid.';
      } else {
        const [rows] = await db.execute<RowDataPacket[]>(
          'SELECT 1 FROM startup_stage WHERE stage_id = ? LIMIT 1',
          [id],
        );
        if (rows.length === 0) {
          errors.stageId = 'Selected stage does not exist.';
        } else {
          values.stageId = id;
        }
      }
    }
  }

  return { values, fieldErrors: errors };
}

/** What a pitch must contain before it may be submitted for review. */
interface SubmissionState {
  brandName: string | null;
  industryId: number | null;
  stageId: number | null;
  pitchHook: string | null;
  originalAskAmount: number | null;
  originalAskEquityPct: number | null;
}

function checkSubmissionComplete(state: SubmissionState): Record<string, string> {
  const missing: Record<string, string> = {};
  const needed = 'Required to submit for review.';
  if (!state.brandName) missing.brandName = needed;
  if (!state.industryId) missing.industryId = needed;
  if (!state.stageId) missing.stageId = needed;
  if (!state.pitchHook || !state.pitchHook.trim()) missing.pitchHook = needed;
  if (state.originalAskAmount === null || !(state.originalAskAmount > 0)) {
    missing.originalAskAmount = 'Enter an investment ask greater than 0 to submit for review.';
  }
  if (state.originalAskEquityPct === null) missing.originalAskEquityPct = needed;
  return missing;
}

function submissionIncomplete(missing: Record<string, string>): FounderFailure {
  return fail(
    400,
    'SUBMISSION_INCOMPLETE',
    `Complete these fields before submitting for review: ${Object.keys(missing).join(', ')}.`,
    missing,
  );
}

function validationFailed(fieldErrors: Record<string, string>): FounderFailure {
  const first = Object.values(fieldErrors)[0] ?? 'Invalid pitch data.';
  return fail(400, 'VALIDATION_FAILED', first, fieldErrors);
}

/** Parses an optional target status from the client. Only DRAFT/SUBMITTED are allowed. */
function parseTargetStatus(
  raw: unknown,
): { ok: true; status: 'DRAFT' | 'SUBMITTED' | undefined } | { ok: false; failure: FounderFailure } {
  if (raw === undefined) return { ok: true, status: undefined };
  if (raw === 'DRAFT' || raw === 'SUBMITTED') return { ok: true, status: raw };
  return {
    ok: false,
    failure: fail(
      400,
      'INVALID_STATUS_TRANSITION',
      "Founders can only set pitch status to 'DRAFT' or 'SUBMITTED'.",
      { pitchStatus: "Only 'DRAFT' or 'SUBMITTED' is allowed." },
    ),
  };
}

// ----------------------------------------------------------------------------
// Shared SQL
// ----------------------------------------------------------------------------

const PITCH_SELECT = `SELECT
    p.pitch_id AS pitchId,
    p.company_id AS companyId,
    p.pitch_type AS pitchType,
    p.pitch_status AS pitchStatus,
    p.original_ask_amount AS originalAskAmount,
    p.original_ask_equity_pct AS originalAskEquityPct,
    p.pitch_hook AS pitchHook,
    p.submitted_at AS submittedAt,
    c.brand_name AS brandName,
    c.legal_business_name AS legalBusinessName,
    c.business_model AS businessModel,
    c.website_url AS websiteUrl,
    c.founded_year AS foundedYear,
    c.headquarters_city AS headquartersCity,
    c.headquarters_state AS headquartersState,
    c.headquarters_country AS headquartersCountry,
    c.industry_id AS industryId,
    i.industry_name AS industryName,
    c.stage_id AS stageId,
    s.stage_name AS stageName
  FROM pitch p
  INNER JOIN company c ON c.company_id = p.company_id
  LEFT JOIN industry i ON i.industry_id = c.industry_id
  LEFT JOIN startup_stage s ON s.stage_id = c.stage_id`;

async function fetchPitch(db: Queryable, pitchId: number): Promise<FounderPitch | null> {
  const [rows] = await db.execute<RowDataPacket[]>(`${PITCH_SELECT} WHERE p.pitch_id = ?`, [pitchId]);
  return rows.length > 0 ? (rows[0] as FounderPitch) : null;
}

// ----------------------------------------------------------------------------
// Dashboard
// ----------------------------------------------------------------------------

export async function getFounderDashboard(userId: number): Promise<FounderDashboardData> {
  // Archived pitches are removed listings: keep them out of the list and totals.
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `${PITCH_SELECT}
     WHERE p.submitted_by_user_id = ?
       AND p.pitch_type = 'PLATFORM'
       AND p.pitch_status <> 'ARCHIVED'
     ORDER BY p.submitted_at DESC, p.pitch_id DESC`,
    [userId],
  );
  const pitches = rows as FounderPitch[];

  const [archivedRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM pitch
     WHERE submitted_by_user_id = ? AND pitch_type = 'PLATFORM' AND pitch_status = 'ARCHIVED'`,
    [userId],
  );

  const metrics: FounderMetrics = {
    totalCount: pitches.length,
    draftCount: pitches.filter((p) => p.pitchStatus === 'DRAFT').length,
    submittedCount: pitches.filter((p) => p.pitchStatus === 'SUBMITTED').length,
    publishedCount: pitches.filter((p) => p.pitchStatus === 'PUBLISHED').length,
    rejectedCount: pitches.filter((p) => p.pitchStatus === 'REJECTED').length,
    archivedCount: Number(archivedRows[0]?.cnt ?? 0),
  };

  return { metrics, pitches };
}

// ----------------------------------------------------------------------------
// Read one (owner only)
// ----------------------------------------------------------------------------

export async function getFounderPitchById(
  userId: number,
  pitchId: number,
): Promise<FounderResult<{ pitch: FounderPitch }>> {
  const [ownerRows] = await dbPool.execute<RowDataPacket[]>(
    'SELECT pitch_type, submitted_by_user_id FROM pitch WHERE pitch_id = ?',
    [pitchId],
  );
  if (ownerRows.length === 0) {
    return fail(404, 'PITCH_NOT_FOUND', 'Pitch listing not found.');
  }
  const row = ownerRows[0];
  if (row.pitch_type === 'SHOW') {
    return fail(403, 'IMMUTABLE_RECORD', 'Historical Shark Tank pitches are not part of the founder workspace.');
  }
  if (Number(row.submitted_by_user_id) !== userId) {
    return fail(403, 'UNAUTHORIZED_OWNER', 'You are not authorized to view pitches submitted by other users.');
  }
  const pitch = await fetchPitch(dbPool, pitchId);
  if (!pitch) return fail(404, 'PITCH_NOT_FOUND', 'Pitch listing not found.');
  return { success: true, pitch };
}

// ----------------------------------------------------------------------------
// Create
// ----------------------------------------------------------------------------

export async function createFounderPitch(
  userId: number,
  payload: CreatePitchPayload,
): Promise<FounderResult<{ pitchId: number; pitch: FounderPitch }>> {
  if (!isPlainObject(payload)) {
    return fail(400, 'INVALID_BODY', 'A JSON pitch object is required.');
  }

  const target = parseTargetStatus(payload.pitchStatus);
  if (!target.ok) return target.failure;
  const status = target.status ?? 'DRAFT';

  const { values, fieldErrors } = await validatePitchFields(
    payload as unknown as Record<string, unknown>,
    dbPool,
    { requireBrandAndIndustry: true },
  );
  if (Object.keys(fieldErrors).length > 0) return validationFailed(fieldErrors);

  if (status === 'SUBMITTED') {
    const missing = checkSubmissionComplete({
      brandName: values.brandName ?? null,
      industryId: values.industryId ?? null,
      stageId: values.stageId ?? null,
      pitchHook: values.pitchHook ?? null,
      originalAskAmount: values.originalAskAmount ?? null,
      originalAskEquityPct: values.originalAskEquityPct ?? null,
    });
    if (Object.keys(missing).length > 0) return submissionIncomplete(missing);
  }

  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    const [companyResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO company (
         brand_name, legal_business_name, industry_id, stage_id, business_model,
         website_url, founded_year, headquarters_city, headquarters_state, headquarters_country
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        values.brandName!,
        values.legalBusinessName ?? null,
        values.industryId!,
        values.stageId ?? null,
        values.businessModel ?? null,
        values.websiteUrl ?? null,
        values.foundedYear ?? null,
        values.headquartersCity ?? null,
        values.headquartersState ?? null,
        values.headquartersCountry ?? 'India',
      ],
    );

    const [pitchResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO pitch (
         company_id, pitch_type, submitted_by_user_id,
         original_ask_amount, original_ask_equity_pct, pitch_hook,
         pitch_status, submitted_at
       ) VALUES (?, 'PLATFORM', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        companyResult.insertId,
        userId,
        values.originalAskAmount ?? null,
        values.originalAskEquityPct ?? null,
        values.pitchHook ?? null,
        status,
      ],
    );

    await conn.commit();

    const pitch = await fetchPitch(dbPool, pitchResult.insertId);
    return { success: true, pitchId: pitchResult.insertId, pitch: pitch as FounderPitch };
  } catch (err) {
    await conn.rollback();
    console.error('Failed to create founder pitch:', err);
    return fail(500, 'SERVER_ERROR', 'Failed to create startup pitch. Please try again.');
  } finally {
    conn.release();
  }
}

// ----------------------------------------------------------------------------
// Update (owner only, lifecycle enforced)
// ----------------------------------------------------------------------------

export async function updateFounderPitch(
  userId: number,
  pitchId: number,
  payload: Partial<CreatePitchPayload>,
  isAdmin = false,
): Promise<FounderResult<{ pitch: FounderPitch }>> {
  if (!isPlainObject(payload)) {
    return fail(400, 'INVALID_BODY', 'A JSON pitch object is required.');
  }

  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the pitch + company rows so status checks and the write are atomic.
    const [existingRows] = await conn.execute<RowDataPacket[]>(
      `SELECT p.pitch_id, p.company_id, p.pitch_type, p.submitted_by_user_id, p.pitch_status,
              p.original_ask_amount, p.original_ask_equity_pct, p.pitch_hook,
              c.brand_name, c.industry_id, c.stage_id
       FROM pitch p
       INNER JOIN company c ON c.company_id = p.company_id
       WHERE p.pitch_id = ?
       FOR UPDATE`,
      [pitchId],
    );

    if (existingRows.length === 0) {
      await conn.rollback();
      return fail(404, 'PITCH_NOT_FOUND', 'Pitch listing not found.');
    }
    const existing = existingRows[0];

    // Never allow editing SHOW television records.
    if (existing.pitch_type === 'SHOW') {
      await conn.rollback();
      return fail(
        403,
        'IMMUTABLE_RECORD',
        'Historical Shark Tank television pitches are permanent records and cannot be edited.',
      );
    }

    // Authoritative owner of a PLATFORM pitch is pitch.submitted_by_user_id.
    // The separate Admin correction route may edit another user's PLATFORM listing,
    // but it does not permit editing SHOW records or changing pitch status.
    if (!isAdmin && Number(existing.submitted_by_user_id) !== userId) {
      await conn.rollback();
      return fail(403, 'UNAUTHORIZED_OWNER', 'You are not authorized to modify pitches submitted by other users.');
    }
    if (isAdmin && payload.pitchStatus !== undefined) {
      await conn.rollback();
      return fail(400, 'ADMIN_STATUS_CHANGE_FORBIDDEN', 'Use the review-decision or archive endpoint to change a listing status.');
    }

    const target = parseTargetStatus(payload.pitchStatus);
    if (!target.ok) {
      await conn.rollback();
      return target.failure;
    }

    // --- lifecycle rules ---
    const current = existing.pitch_status as PitchStatus;
    let nextStatus: PitchStatus;

    if (isAdmin && (current === 'PUBLISHED' || current === 'DRAFT' || current === 'REJECTED')) {
      // Admin correction preserves current state. Review and archive remain separate operations.
      nextStatus = current;
    } else if (current === 'PUBLISHED') {
      await conn.rollback();
      return fail(409, 'PITCH_PUBLISHED_LOCKED', 'A published pitch is live and cannot be edited by its owner.');
    } else if (current === 'ARCHIVED') {
      await conn.rollback();
      return fail(409, 'PITCH_ARCHIVED_LOCKED', 'An archived pitch cannot be edited.');
    } else if (current === 'SUBMITTED') {
      if (isAdmin) {
        await conn.rollback();
        return fail(409, 'PITCH_UNDER_REVIEW', 'A submitted pitch must be decided in the review queue before correction.');
      }
      if (target.status !== 'DRAFT') {
        await conn.rollback();
        return fail(
          409,
          'PITCH_UNDER_REVIEW',
          'This pitch is under review. Withdraw it to draft before making changes.',
        );
      }
      nextStatus = 'DRAFT';
    } else {
      // Owner edits: DRAFT or REJECTED becomes DRAFT unless explicitly resubmitted.
      nextStatus = target.status ?? 'DRAFT';
    }

    // --- field validation (same rules as create) ---
    const { values, fieldErrors } = await validatePitchFields(
      payload as unknown as Record<string, unknown>,
      conn,
      { requireBrandAndIndustry: false },
    );
    if (Object.keys(fieldErrors).length > 0) {
      await conn.rollback();
      return validationFailed(fieldErrors);
    }

    // --- stricter completeness check on the FINAL merged state when submitting ---
    if (nextStatus === 'SUBMITTED') {
      const missing = checkSubmissionComplete({
        brandName: values.brandName ?? (existing.brand_name as string | null),
        industryId: values.industryId ?? (existing.industry_id as number | null),
        stageId: values.stageId !== undefined ? values.stageId : (existing.stage_id as number | null),
        pitchHook: values.pitchHook !== undefined ? values.pitchHook : (existing.pitch_hook as string | null),
        originalAskAmount:
          values.originalAskAmount !== undefined
            ? values.originalAskAmount
            : existing.original_ask_amount === null
              ? null
              : Number(existing.original_ask_amount),
        originalAskEquityPct:
          values.originalAskEquityPct !== undefined
            ? values.originalAskEquityPct
            : existing.original_ask_equity_pct === null
              ? null
              : Number(existing.original_ask_equity_pct),
      });
      if (Object.keys(missing).length > 0) {
        await conn.rollback();
        return submissionIncomplete(missing);
      }
    }

    // --- company columns ---
    const companyMap: Array<[keyof PitchFieldValues, string]> = [
      ['brandName', 'brand_name'],
      ['legalBusinessName', 'legal_business_name'],
      ['industryId', 'industry_id'],
      ['stageId', 'stage_id'],
      ['businessModel', 'business_model'],
      ['websiteUrl', 'website_url'],
      ['foundedYear', 'founded_year'],
      ['headquartersCity', 'headquarters_city'],
      ['headquartersState', 'headquarters_state'],
      ['headquartersCountry', 'headquarters_country'],
    ];
    const companySets: string[] = [];
    const companyParams: Array<string | number | null> = [];
    for (const [key, column] of companyMap) {
      if (values[key] === undefined) continue;
      companySets.push(`${column} = ?`);
      // headquarters_country falls back to India when cleared, as on create.
      companyParams.push(key === 'headquartersCountry' ? ((values[key] as string | null) ?? 'India') : (values[key] as string | number | null));
    }
    if (companySets.length > 0) {
      companyParams.push(existing.company_id as number);
      await conn.execute(`UPDATE company SET ${companySets.join(', ')} WHERE company_id = ?`, companyParams);
    }

    // --- pitch columns ---
    const pitchSets: string[] = ['pitch_status = ?'];
    const pitchParams: Array<string | number | null> = [nextStatus];
    // The review queue uses submitted_at as the submission timestamp. Refresh it
    // only on a transition into SUBMITTED (including resubmission after rejection).
    if (nextStatus === 'SUBMITTED' && current !== 'SUBMITTED') {
      pitchSets.push('submitted_at = CURRENT_TIMESTAMP');
    }
    if (values.originalAskAmount !== undefined) {
      pitchSets.push('original_ask_amount = ?');
      pitchParams.push(values.originalAskAmount);
    }
    if (values.originalAskEquityPct !== undefined) {
      pitchSets.push('original_ask_equity_pct = ?');
      pitchParams.push(values.originalAskEquityPct);
    }
    if (values.pitchHook !== undefined) {
      pitchSets.push('pitch_hook = ?');
      pitchParams.push(values.pitchHook);
    }
    pitchParams.push(pitchId);
    await conn.execute(`UPDATE pitch SET ${pitchSets.join(', ')} WHERE pitch_id = ?`, pitchParams);

    await conn.commit();

    const pitch = await fetchPitch(dbPool, pitchId);
    return { success: true, pitch: pitch as FounderPitch };
  } catch (err) {
    await conn.rollback();
    console.error('Failed to update founder pitch:', err);
    return fail(500, 'SERVER_ERROR', 'Failed to update pitch details.');
  } finally {
    conn.release();
  }
}

// ----------------------------------------------------------------------------
// Archive (owner only) - never physically deletes anything
// ----------------------------------------------------------------------------

export interface ArchiveSummary {
  withdrawnRequests: number;
  endedConnections: number;
}

export async function archiveFounderPitch(
  userId: number,
  pitchId: number,
  isAdmin = false,
): Promise<FounderResult<{ pitch: FounderPitch; summary: ArchiveSummary }>> {
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT pitch_id, pitch_type, submitted_by_user_id, pitch_status
       FROM pitch WHERE pitch_id = ? FOR UPDATE`,
      [pitchId],
    );
    if (rows.length === 0) {
      await conn.rollback();
      return fail(404, 'PITCH_NOT_FOUND', 'Pitch listing not found.');
    }
    const row = rows[0];
    if (row.pitch_type === 'SHOW') {
      await conn.rollback();
      return fail(
        403,
        'IMMUTABLE_RECORD',
        'Historical Shark Tank television pitches are permanent records and cannot be archived.',
      );
    }
    if (!isAdmin && Number(row.submitted_by_user_id) !== userId) {
      await conn.rollback();
      return fail(403, 'UNAUTHORIZED_OWNER', 'You are not authorized to archive pitches submitted by other users.');
    }
    if (row.pitch_status === 'ARCHIVED') {
      await conn.rollback();
      return fail(409, 'ALREADY_ARCHIVED', 'This pitch is already archived.');
    }

    // 1. Archive the listing (soft removal; rows are preserved).
    await conn.execute(`UPDATE pitch SET pitch_status = 'ARCHIVED' WHERE pitch_id = ?`, [pitchId]);

    // 2. Active conversations of accepted connections become read-only.
    //    Must run BEFORE the requests are changed to ENDED (it joins on ACCEPTED).
    await conn.execute(
      `UPDATE conversation cv
       INNER JOIN connection_request cr ON cr.request_id = cv.request_id
       SET cv.conversation_status = 'READ_ONLY', cv.closed_at = CURRENT_TIMESTAMP
       WHERE cr.pitch_id = ? AND cr.request_status = 'ACCEPTED' AND cv.conversation_status = 'OPEN'`,
      [pitchId],
    );

    // 3. Accepted connections end; history and responded_at are retained.
    const [endedResult] = await conn.execute<ResultSetHeader>(
      `UPDATE connection_request
       SET request_status = 'ENDED', ended_at = CURRENT_TIMESTAMP, status_reason = 'listing deleted'
       WHERE pitch_id = ? AND request_status = 'ACCEPTED'`,
      [pitchId],
    );

    // 4. Pending requests are withdrawn.
    const [withdrawnResult] = await conn.execute<ResultSetHeader>(
      `UPDATE connection_request
       SET request_status = 'WITHDRAWN', withdrawn_at = CURRENT_TIMESTAMP, status_reason = 'listing deleted'
       WHERE pitch_id = ? AND request_status = 'PENDING'`,
      [pitchId],
    );

    await conn.commit();

    const pitch = await fetchPitch(dbPool, pitchId);
    return {
      success: true,
      pitch: pitch as FounderPitch,
      summary: {
        withdrawnRequests: withdrawnResult.affectedRows,
        endedConnections: endedResult.affectedRows,
      },
    };
  } catch (err) {
    await conn.rollback();
    console.error('Failed to archive founder pitch:', err);
    return fail(500, 'SERVER_ERROR', 'Failed to archive pitch.');
  } finally {
    conn.release();
  }
}
