import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbPool } from './db.js';

type Failure = { success: false; status: number; error: string; message: string };
type Success<T> = { success: true; data: T };
type ServiceResult<T> = Success<T> | Failure;

function bad(error: string, message: string, status = 400): Failure {
  return { success: false, status, error, message };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateString(value: unknown, name: string, max: number, nullable = true): string | null | undefined | Failure {
  if (value === undefined) return undefined;
  if (value === null && nullable) return null;
  if (typeof value !== 'string') return bad('INVALID_INPUT', `${name} must be a string${nullable ? ' or null' : ''}.`);
  const trimmed = value.trim();
  if (!trimmed && !nullable) return bad('INVALID_INPUT', `${name} cannot be blank.`);
  if (trimmed.length > max) return bad('INVALID_INPUT', `${name} must be at most ${max} characters.`);
  return trimmed || null;
}

function validatePhoneNumber(value: unknown): string | null | undefined | Failure {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return bad('INVALID_INPUT', 'phoneNumber must be a string or null.');
  const trimmed = value.trim();
  if (!trimmed) return null;
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{5,20}$/;
  if (!phoneRegex.test(trimmed) || trimmed.length > 25) {
    return bad('INVALID_INPUT', 'Please provide a valid phone number format (e.g., +91 98765 43210).');
  }
  return trimmed;
}

function validateNonNegativeInteger(value: unknown, name: string): number | undefined | Failure {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return bad('INVALID_INPUT', `${name} must be a non-negative integer.`);
  }
  return value;
}

function validateNonNegativeAmount(value: unknown, name: string): number | null | undefined | Failure {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 999999999999999) {
    return bad('INVALID_INPUT', `${name} must be a non-negative amount.`);
  }
  return n;
}

function isFailure(value: unknown): value is Failure {
  return typeof value === 'object' && value !== null && 'success' in value && (value as { success: unknown }).success === false;
}

const FORBIDDEN_PROFILE_FIELDS = new Set([
  'userId',
  'user_id',
  'role',
  'roles',
  'founderId',
  'founder_id',
  'investorId',
  'investor_id',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
]);

export async function getFounderRoleProfile(userId: number): Promise<ServiceResult<Record<string, unknown>>> {
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT founder_id AS founderId, user_id AS userId, first_name AS firstName,
            last_name AS lastName, gender, date_of_birth AS dateOfBirth,
            phone_number AS phoneNumber,
            highest_education AS highestEducation, prior_startups_count AS priorStartupsCount,
            city, state, country
     FROM founder WHERE user_id = ?`,
    [userId],
  );
  if (rows.length === 0) return bad('FOUNDER_PROFILE_NOT_FOUND', 'Activate the Founder workspace before editing this profile.', 404);
  return { success: true, data: rows[0] as Record<string, unknown> };
}

export async function updateFounderRoleProfile(
  userId: number,
  body: unknown,
): Promise<ServiceResult<Record<string, unknown>>> {
  if (!isObject(body)) return bad('INVALID_BODY', 'A JSON object is required.');

  for (const key of Object.keys(body)) {
    if (FORBIDDEN_PROFILE_FIELDS.has(key)) {
      return bad('PRIVILEGED_FIELD_FORBIDDEN', `Setting privileged field '${key}' is not permitted.`);
    }
  }

  const mapping: Array<[string, string, number, boolean]> = [
    ['firstName', 'first_name', 80, false],
    ['lastName', 'last_name', 80, true],
    ['gender', 'gender', 30, true],
    ['highestEducation', 'highest_education', 120, true],
    ['city', 'city', 100, true],
    ['state', 'state', 100, true],
    ['country', 'country', 100, true],
  ];
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  for (const [key, column, max, nullable] of mapping) {
    if (!(key in body)) continue;
    const value = validateString(body[key], key, max, nullable);
    if (isFailure(value)) return value;
    sets.push(`${column} = ?`);
    params.push(value as string | null);
  }
  if ('phoneNumber' in body) {
    const value = validatePhoneNumber(body.phoneNumber);
    if (isFailure(value)) return value;
    sets.push('phone_number = ?');
    params.push(value as string | null);
  }
  if ('dateOfBirth' in body) {
    const value = body.dateOfBirth;
    if (value !== null) {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return bad('INVALID_INPUT', 'dateOfBirth must be a valid YYYY-MM-DD date or null.');
      }
      const parsedDate = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
        return bad('INVALID_INPUT', 'dateOfBirth must be a valid calendar date or null.');
      }
    }
    sets.push('date_of_birth = ?');
    params.push(value as string | null);
  }
  if ('priorStartupsCount' in body) {
    const value = validateNonNegativeInteger(body.priorStartupsCount, 'priorStartupsCount');
    if (isFailure(value)) return value;
    sets.push('prior_startups_count = ?');
    params.push(value as number);
  }
  if (sets.length === 0) return bad('NO_FIELDS', 'Provide at least one editable Founder profile field.');

  const [exists] = await dbPool.execute<RowDataPacket[]>('SELECT founder_id FROM founder WHERE user_id = ?', [userId]);
  if (exists.length === 0) return bad('FOUNDER_PROFILE_NOT_FOUND', 'Activate the Founder workspace before editing this profile.', 404);
  await dbPool.execute(`UPDATE founder SET ${sets.join(', ')} WHERE user_id = ?`, [...params, userId]);
  return getFounderRoleProfile(userId);
}

export async function getInvestorRoleProfile(userId: number): Promise<ServiceResult<Record<string, unknown>>> {
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT i.investor_id AS investorId, i.user_id AS userId, i.first_name AS firstName,
            i.last_name AS lastName, i.display_name AS displayName,
            i.investment_firm_name AS investmentFirmName, i.net_worth AS netWorth,
            i.primary_industry_id AS primaryIndustryId, i.city, i.state, i.country,
            ip.biography, ip.min_investment_amount AS minInvestmentAmount,
            ip.max_investment_amount AS maxInvestmentAmount, ip.is_accepting_pitches AS isAcceptingPitches
     FROM investor i LEFT JOIN investor_profile ip ON ip.investor_id = i.investor_id
     WHERE i.user_id = ?`,
    [userId],
  );
  if (rows.length === 0) return bad('INVESTOR_PROFILE_NOT_FOUND', 'Activate the Investor workspace before editing this profile.', 404);
  const investor = rows[0];
  const investorId = Number(investor.investorId);
  const [industryRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT industry_id AS industryId FROM investor_industry_preference WHERE investor_id = ? ORDER BY industry_id`, [investorId],
  );
  const [stageRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT stage_id AS stageId FROM investor_stage_preference WHERE investor_id = ? ORDER BY stage_id`, [investorId],
  );
  return { success: true, data: { ...investor, isAcceptingPitches: Boolean(investor.isAcceptingPitches), industryPreferences: industryRows.map(r => Number(r.industryId)), stagePreferences: stageRows.map(r => Number(r.stageId)) } };
}

export async function updateInvestorRoleProfile(
  userId: number,
  body: unknown,
): Promise<ServiceResult<Record<string, unknown>>> {
  if (!isObject(body)) return bad('INVALID_BODY', 'A JSON object is required.');

  for (const key of Object.keys(body)) {
    if (FORBIDDEN_PROFILE_FIELDS.has(key)) {
      return bad('PRIVILEGED_FIELD_FORBIDDEN', `Setting privileged field '${key}' is not permitted.`);
    }
  }

  const [profileRows] = await dbPool.execute<RowDataPacket[]>('SELECT investor_id AS investorId FROM investor WHERE user_id = ?', [userId]);
  if (profileRows.length === 0) return bad('INVESTOR_PROFILE_NOT_FOUND', 'Activate the Investor workspace before editing this profile.', 404);
  const investorId = Number(profileRows[0].investorId);

  const investorMap: Array<[string, string, number, boolean]> = [
    ['firstName', 'first_name', 80, false],
    ['lastName', 'last_name', 80, true],
    ['displayName', 'display_name', 150, true],
    ['investmentFirmName', 'investment_firm_name', 180, true],
    ['city', 'city', 100, true],
    ['state', 'state', 100, true],
    ['country', 'country', 100, true],
  ];
  const investorSets: string[] = [];
  const investorParams: Array<string | number | null> = [];
  for (const [key, column, max, nullable] of investorMap) {
    if (!(key in body)) continue;
    const value = validateString(body[key], key, max, nullable);
    if (isFailure(value)) return value;
    investorSets.push(`${column} = ?`);
    investorParams.push(value as string | null);
  }
  if ('primaryIndustryId' in body) {
    const value = body.primaryIndustryId === null ? null : Number(body.primaryIndustryId);
    if (value !== null && (!Number.isSafeInteger(value) || value < 1)) return bad('INVALID_INPUT', 'primaryIndustryId must be a positive integer or null.');
    if (value !== null) {
      const [found] = await dbPool.execute<RowDataPacket[]>('SELECT industry_id FROM industry WHERE industry_id = ?', [value]);
      if (found.length === 0) return bad('INVALID_REFERENCE', 'primaryIndustryId does not exist.');
    }
    investorSets.push('primary_industry_id = ?');
    investorParams.push(value);
  }
  if ('netWorth' in body) {
    const value = validateNonNegativeAmount(body.netWorth, 'netWorth');
    if (isFailure(value)) return value;
    investorSets.push('net_worth = ?');
    investorParams.push(value as number | null);
  }

  const profileMap: Array<[string, string, number]> = [
    ['biography', 'biography', 5000],
  ];
  const profileSets: string[] = [];
  const profileParams: Array<string | number | null> = [];
  for (const [key, column, max] of profileMap) {
    if (!(key in body)) continue;
    const value = validateString(body[key], key, max, true);
    if (isFailure(value)) return value;
    profileSets.push(`${column} = ?`);
    profileParams.push(value as string | null);
  }
  for (const [key, column] of [['minInvestmentAmount', 'min_investment_amount'], ['maxInvestmentAmount', 'max_investment_amount']] as const) {
    if (!(key in body)) continue;
    const value = validateNonNegativeAmount(body[key], key);
    if (isFailure(value)) return value;
    profileSets.push(`${column} = ?`);
    profileParams.push(value as number | null);
  }
  if ('isAcceptingPitches' in body) {
    if (typeof body.isAcceptingPitches !== 'boolean') return bad('INVALID_INPUT', 'isAcceptingPitches must be a boolean.');
    profileSets.push('is_accepting_pitches = ?');
    profileParams.push(body.isAcceptingPitches ? 1 : 0);
  }

  const preferences: Array<{ key: string; table: string; column: string; referenceTable: string; referenceColumn: string }> = [
    { key: 'industryPreferences', table: 'investor_industry_preference', column: 'industry_id', referenceTable: 'industry', referenceColumn: 'industry_id' },
    { key: 'stagePreferences', table: 'investor_stage_preference', column: 'stage_id', referenceTable: 'startup_stage', referenceColumn: 'stage_id' },
  ];
  for (const pref of preferences) {
    if (!(pref.key in body)) continue;
    const raw = body[pref.key];
    if (!Array.isArray(raw) || raw.length > 30) return bad('INVALID_INPUT', `${pref.key} must be an array of up to 30 positive IDs.`);
    const ids = [...new Set(raw.map(Number))];
    if (ids.some(id => !Number.isSafeInteger(id) || id < 1)) return bad('INVALID_INPUT', `${pref.key} must contain positive integer IDs.`);
    if (ids.length) {
      const marks = ids.map(() => '?').join(',');
      const [valid] = await dbPool.execute<RowDataPacket[]>(`SELECT ${pref.referenceColumn} AS id FROM ${pref.referenceTable} WHERE ${pref.referenceColumn} IN (${marks})`, ids);
      if (valid.length !== ids.length) return bad('INVALID_REFERENCE', `${pref.key} contains an unknown reference ID.`);
    }
  }

  const minAmount = 'minInvestmentAmount' in body ? (body.minInvestmentAmount === null ? null : Number(body.minInvestmentAmount)) : undefined;
  const maxAmount = 'maxInvestmentAmount' in body ? (body.maxInvestmentAmount === null ? null : Number(body.maxInvestmentAmount)) : undefined;
  if (minAmount !== undefined || maxAmount !== undefined) {
    const [currentRows] = await dbPool.execute<RowDataPacket[]>(
      'SELECT min_investment_amount AS minAmount, max_investment_amount AS maxAmount FROM investor_profile WHERE investor_id = ?', [investorId],
    );
    const finalMin = minAmount !== undefined ? minAmount : (currentRows[0]?.minAmount == null ? null : Number(currentRows[0].minAmount));
    const finalMax = maxAmount !== undefined ? maxAmount : (currentRows[0]?.maxAmount == null ? null : Number(currentRows[0].maxAmount));
    if (finalMin !== null && finalMax !== null && finalMin > finalMax) return bad('INVALID_INPUT', 'minInvestmentAmount cannot exceed maxInvestmentAmount.');
  }

  if (!investorSets.length && !profileSets.length && !preferences.some(p => p.key in body)) return bad('NO_FIELDS', 'Provide at least one editable Investor profile field.');

  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    if (investorSets.length) await conn.execute(`UPDATE investor SET ${investorSets.join(', ')} WHERE investor_id = ?`, [...investorParams, investorId]);
    await conn.execute('INSERT IGNORE INTO investor_profile (investor_id) VALUES (?)', [investorId]);
    if (profileSets.length) await conn.execute(`UPDATE investor_profile SET ${profileSets.join(', ')} WHERE investor_id = ?`, [...profileParams, investorId]);
    for (const pref of preferences) {
      if (!(pref.key in body)) continue;
      const ids = [...new Set((body[pref.key] as unknown[]).map(Number))];
      await conn.execute(`DELETE FROM ${pref.table} WHERE investor_id = ?`, [investorId]);
      if (ids.length) {
        const values = ids.map(() => '(?, ?)').join(', ');
        const params: number[] = [];
        for (const id of ids) params.push(investorId, id);
        await conn.execute(`INSERT INTO ${pref.table} (investor_id, ${pref.column}) VALUES ${values}`, params);
      }
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    throw error;
  } finally {
    conn.release();
  }
  return getInvestorRoleProfile(userId);
}
