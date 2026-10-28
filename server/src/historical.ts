import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { dbPool } from './db.js';
import { parseHistoricalCsv } from './historicalCsv.js';
export { parseHistoricalCsv } from './historicalCsv.js';

// Values passed to parameterized MySQL queries; unknown request-body values are validated before reaching this type.
type SqlInputValue = string | number | null;

export class HistoricalServiceError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'HistoricalServiceError';
  }
}

function fail(status: number, code: string, message: string): never {
  throw new HistoricalServiceError(status, code, message);
}

function objectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) fail(400, 'INVALID_BODY', 'A JSON object is required.');
  return body as Record<string, unknown>;
}

function positiveId(value: unknown, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) fail(400, 'INVALID_ID', `${label} must be a positive integer.`);
  return parsed;
}

function optionalText(body: Record<string, unknown>, key: string, max: number, required = false): string | null | undefined {
  if (!(key in body)) {
    if (required) fail(400, 'INVALID_INPUT', `${key} is required.`);
    return undefined;
  }
  const value = body[key];
  if (value === null && !required) return null;
  if (typeof value !== 'string') fail(400, 'INVALID_INPUT', `${key} must be a string${required ? '' : ' or null'}.`);
  const trimmed = value.trim();
  if (required && !trimmed) fail(400, 'INVALID_INPUT', `${key} cannot be blank.`);
  if (trimmed.length > max) fail(400, 'INVALID_INPUT', `${key} must be at most ${max} characters.`);
  return trimmed || null;
}

function optionalNumber(body: Record<string, unknown>, key: string, options: { required?: boolean; integer?: boolean; min?: number; max?: number } = {}): number | null | undefined {
  if (!(key in body)) {
    if (options.required) fail(400, 'INVALID_INPUT', `${key} is required.`);
    return undefined;
  }
  if (body[key] === null && !options.required) return null;
  const value = typeof body[key] === 'number' ? body[key] as number : Number(body[key]);
  if (!Number.isFinite(value) || (options.integer && !Number.isSafeInteger(value)) || (options.min !== undefined && value < options.min) || (options.max !== undefined && value > options.max)) {
    fail(400, 'INVALID_INPUT', `${key} has an invalid numeric value.`);
  }
  return value;
}

export function normalizeDateValue(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function optionalDate(body: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in body)) return undefined;
  const value = body[key];
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, 'INVALID_INPUT', `${key} must be YYYY-MM-DD or null.`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail(400, 'INVALID_INPUT', `${key} is not a valid calendar date.`);
  return value;
}

function mapDbError(error: unknown): never {
  const dbError = error as { code?: string };
  if (dbError?.code === 'ER_DUP_ENTRY') fail(409, 'DUPLICATE_RECORD', 'A record with the same unique key already exists.');
  if (dbError?.code === 'ER_ROW_IS_REFERENCED_2' || dbError?.code === 'ER_ROW_IS_REFERENCED') fail(409, 'RECORD_IN_USE', 'This historical record is referenced by other records. Remove or reassign those records first.');
  if (dbError?.code === 'ER_NO_REFERENCED_ROW_2') fail(400, 'INVALID_REFERENCE', 'One or more referenced records do not exist.');
  throw error;
}

export async function listHistoricalSeasons(limit = 50, offset = 0, franchise?: string) {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const safeOffset = Math.max(0, Math.trunc(offset));
  const where = franchise ? 'WHERE s.country_franchise = ?' : '';
  const params: Array<string | number> = franchise ? [franchise, safeLimit, safeOffset] : [safeLimit, safeOffset];
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT s.season_id AS seasonId, s.season_number AS seasonNumber,
            s.country_franchise AS countryFranchise, s.premiere_date AS premiereDate,
            s.finale_date AS finaleDate, s.total_episodes AS totalEpisodes,
            s.network_channel AS networkChannel, s.production_house AS productionHouse,
            (SELECT COUNT(*) FROM show_episode e WHERE e.season_id = s.season_id) AS storedEpisodeCount,
            (SELECT COUNT(DISTINCT p.pitch_id) FROM show_episode e JOIN pitch p ON p.episode_id = e.episode_id AND p.pitch_type = 'SHOW' WHERE e.season_id = s.season_id) AS storedPitchCount
     FROM show_season s ${where}
     ORDER BY s.country_franchise, s.season_number, s.season_id ASC
     LIMIT ? OFFSET ?`, params,
  );
  return rows;
}

export async function listHistoricalEpisodes(seasonIdValue: unknown, limit = 100, offset = 0) {
  const seasonId = positiveId(seasonIdValue, 'seasonId');
  const [season] = await dbPool.execute<RowDataPacket[]>('SELECT season_id FROM show_season WHERE season_id = ?', [seasonId]);
  if (!season.length) fail(404, 'SEASON_NOT_FOUND', 'Historical season not found.');
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT e.episode_id AS episodeId, e.season_id AS seasonId, e.episode_number AS episodeNumber,
            e.episode_title AS episodeTitle, e.tape_date AS tapeDate, e.air_date AS airDate,
            e.duration_minutes AS durationMinutes, e.tv_rating AS tvRating,
            e.viewers_count_millions AS viewersCountMillions, e.filming_location AS filmingLocation,
            e.video_url AS videoUrl,
            (SELECT COUNT(*) FROM pitch p WHERE p.episode_id = e.episode_id AND p.pitch_type = 'SHOW') AS pitchCount,
            (SELECT COUNT(*) FROM episode_shark_seat ess WHERE ess.episode_id = e.episode_id) AS sharkCount
     FROM show_episode e WHERE e.season_id = ?
     ORDER BY e.episode_number, e.episode_id ASC LIMIT ? OFFSET ?`,
    [seasonId, Math.max(1, Math.min(100, Math.trunc(limit))), Math.max(0, Math.trunc(offset))],
  );
  return rows;
}

export async function getHistoricalEpisodeDetail(episodeIdValue: unknown) {
  const episodeId = positiveId(episodeIdValue, 'episodeId');
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT e.episode_id AS episodeId, e.episode_number AS episodeNumber, e.episode_title AS episodeTitle,
            e.tape_date AS tapeDate, e.air_date AS airDate, e.duration_minutes AS durationMinutes,
            e.tv_rating AS tvRating, e.viewers_count_millions AS viewersCountMillions,
            e.filming_location AS filmingLocation, e.video_url AS videoUrl,
            s.season_id AS seasonId, s.season_number AS seasonNumber, s.country_franchise AS countryFranchise
     FROM show_episode e JOIN show_season s ON s.season_id = e.season_id WHERE e.episode_id = ?`, [episodeId],
  );
  if (!rows.length) fail(404, 'EPISODE_NOT_FOUND', 'Historical episode not found.');
  const [pitches] = await dbPool.execute<RowDataPacket[]>(
    `SELECT p.pitch_id AS pitchId, p.company_id AS companyId, p.pitch_sequence_order AS pitchSequenceOrder,
            p.pitch_hook AS pitchHook, p.original_ask_amount AS originalAskAmount,
            p.original_ask_equity_pct AS originalAskEquityPct, c.brand_name AS brandName,
            c.legal_business_name AS legalBusinessName, c.business_model AS businessModel,
            c.website_url AS websiteUrl, c.founded_year AS foundedYear,
            c.headquarters_city AS headquartersCity, c.headquarters_state AS headquartersState,
            c.headquarters_country AS headquartersCountry, i.industry_name AS industry,
            st.stage_name AS startupStage, d.deal_status AS dealStatus,
            d.final_agreed_amount AS finalAgreedAmount, d.final_agreed_equity_pct AS finalAgreedEquityPct
     FROM pitch p JOIN company c ON c.company_id = p.company_id
     LEFT JOIN industry i ON i.industry_id = c.industry_id
     LEFT JOIN startup_stage st ON st.stage_id = c.stage_id
     LEFT JOIN closed_deal d ON d.pitch_id = p.pitch_id
     WHERE p.episode_id = ? AND p.pitch_type = 'SHOW'
     ORDER BY p.pitch_sequence_order, p.pitch_id`, [episodeId],
  );
  const [sharks] = await dbPool.execute<RowDataPacket[]>(
    `SELECT sh.shark_id AS sharkId, sh.stage_name AS stageName, sh.gender, sh.is_guest_shark AS isGuestShark,
            i.display_name AS displayName, i.investment_firm_name AS investmentFirmName,
            seat.chair_position_number AS chairPositionNumber
     FROM episode_shark_seat seat JOIN shark sh ON sh.shark_id = seat.shark_id
     JOIN investor i ON i.investor_id = sh.investor_id
     WHERE seat.episode_id = ? ORDER BY seat.chair_position_number`, [episodeId],
  );
  const pitchIds = pitches.map(p => Number(p.pitchId));
  let offers: RowDataPacket[] = [];
  if (pitchIds.length) {
    const marks = pitchIds.map(() => '?').join(',');
    const [offerRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT o.offer_id AS offerId, o.pitch_id AS pitchId, o.round_number AS roundNumber,
              o.is_counter_offer AS isCounterOffer, o.amount_offered AS amountOffered,
              o.equity_requested_pct AS equityRequestedPct, o.royalty_per_unit AS royaltyPerUnit,
              o.royalty_cap_amount AS royaltyCapAmount, o.loan_amount AS loanAmount,
              o.loan_interest_rate_pct AS loanInterestRatePct, o.advisory_shares_pct AS advisorySharesPct,
              o.offer_status AS offerStatus, i.display_name AS createdByInvestorName
       FROM offer o LEFT JOIN investor i ON i.investor_id = o.created_by_investor_id
       WHERE o.pitch_id IN (${marks}) ORDER BY o.pitch_id, o.round_number, o.offer_id`, pitchIds,
    );
    offers = offerRows;
  }
  return { episode: rows[0], pitches, sharks, offers };
}

export interface HistoricalSearchFilters {
  search?: string;
  seasonId?: number;
  industryId?: number;
  sharkId?: number;
  dealStatus?: 'PENDING_DUE_DILIGENCE' | 'COMPLETED' | 'FELL_THROUGH' | 'UNKNOWN';
  limit?: number;
  offset?: number;
}

export async function searchHistoricalPitches(filters: HistoricalSearchFilters = {}) {
  if (filters.dealStatus !== undefined && !['PENDING_DUE_DILIGENCE', 'COMPLETED', 'FELL_THROUGH', 'UNKNOWN'].includes(filters.dealStatus)) {
    fail(400, 'INVALID_DEAL_STATUS', 'dealStatus filter is invalid.');
  }
  const where = ["p.pitch_type = 'SHOW'"];
  const params: Array<string | number> = [];
  if (filters.seasonId) { where.push('s.season_id = ?'); params.push(positiveId(filters.seasonId, 'seasonId')); }
  if (filters.industryId) { where.push('c.industry_id = ?'); params.push(positiveId(filters.industryId, 'industryId')); }
  if (filters.dealStatus) {
    if (filters.dealStatus === 'UNKNOWN') where.push('d.deal_id IS NULL');
    else { where.push('d.deal_status = ?'); params.push(filters.dealStatus); }
  }
  if (filters.sharkId) {
    where.push(`EXISTS (SELECT 1 FROM episode_shark_seat ess WHERE ess.episode_id = e.episode_id AND ess.shark_id = ?)`);
    params.push(positiveId(filters.sharkId, 'sharkId'));
  }
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    where.push(`(LOWER(c.brand_name) LIKE ? OR LOWER(COALESCE(c.legal_business_name, '')) LIKE ? OR LOWER(COALESCE(p.pitch_hook, '')) LIKE ?)`);
    params.push(term, term, term);
  }
  if (filters.limit !== undefined) {
    const l = Number(filters.limit);
    if (!Number.isSafeInteger(l) || l < 1) fail(400, 'INVALID_PAGINATION', 'limit must be a positive integer.');
  }
  if (filters.offset !== undefined) {
    const o = Number(filters.offset);
    if (!Number.isSafeInteger(o) || o < 0) fail(400, 'INVALID_PAGINATION', 'offset must be a non-negative integer.');
  }
  params.push(Math.max(1, Math.min(100, Math.trunc(Number(filters.limit ?? 50)))), Math.max(0, Math.trunc(Number(filters.offset ?? 0))));
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT p.pitch_id AS pitchId, p.company_id AS companyId, p.pitch_sequence_order AS pitchSequenceOrder,
            p.pitch_hook AS pitchHook, p.original_ask_amount AS originalAskAmount,
            p.original_ask_equity_pct AS originalAskEquityPct, c.brand_name AS brandName,
            c.legal_business_name AS legalBusinessName, c.business_model AS businessModel,
            c.website_url AS websiteUrl, c.founded_year AS foundedYear,
            c.headquarters_city AS headquartersCity, c.headquarters_state AS headquartersState,
            c.headquarters_country AS headquartersCountry, i.industry_name AS industry,
            s.season_id AS seasonId, s.season_number AS seasonNumber,
            s.country_franchise AS countryFranchise, e.episode_id AS episodeId,
            e.episode_number AS episodeNumber, e.episode_title AS episodeTitle,
            d.deal_status AS dealStatus, d.final_agreed_amount AS finalAgreedAmount,
            d.final_agreed_equity_pct AS finalAgreedEquityPct
     FROM pitch p JOIN company c ON c.company_id = p.company_id
     LEFT JOIN industry i ON i.industry_id = c.industry_id
     JOIN show_episode e ON e.episode_id = p.episode_id
     JOIN show_season s ON s.season_id = e.season_id
     LEFT JOIN closed_deal d ON d.pitch_id = p.pitch_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.country_franchise, s.season_number, e.episode_number, p.pitch_sequence_order, p.pitch_id ASC
     LIMIT ? OFFSET ?`, params,
  );
  return rows;
}

export async function listHistoricalSharks() {
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT sh.shark_id AS sharkId, sh.stage_name AS stageName, sh.gender, sh.birth_date AS birthDate,
            sh.is_guest_shark AS isGuestShark, i.display_name AS displayName,
            i.investment_firm_name AS investmentFirmName,
            (SELECT COUNT(*) FROM episode_shark_seat seat WHERE seat.shark_id = sh.shark_id) AS episodeCount
     FROM shark sh JOIN investor i ON i.investor_id = sh.investor_id
     ORDER BY i.display_name, sh.shark_id ASC`,
  );
  return rows;
}

export async function compareStartups(companyIdsValue: unknown) {
  if (!Array.isArray(companyIdsValue) || (companyIdsValue.length !== 2 && companyIdsValue.length !== 3)) {
    fail(400, 'INVALID_COMPARISON_SIZE', 'Compare exactly two or three startups.');
  }
  const ids = companyIdsValue.map((value, index) => positiveId(value, `companyIds[${index}]`));
  if (new Set(ids).size !== ids.length) fail(400, 'DUPLICATE_COMPARISON_ID', 'Startup IDs must be distinct.');
  const marks = ids.map(() => '?').join(',');
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT c.company_id AS companyId, c.brand_name AS brandName,
            c.legal_business_name AS legalBusinessName, c.business_model AS businessModel,
            c.website_url AS websiteUrl, c.founded_year AS foundedYear,
            c.headquarters_city AS headquartersCity, c.headquarters_state AS headquartersState,
            c.headquarters_country AS headquartersCountry, i.industry_name AS industry,
            st.stage_name AS startupStage,
            GROUP_CONCAT(DISTINCT p.pitch_type ORDER BY p.pitch_type) AS sourceTypes,
            MAX(CASE WHEN p.pitch_type = 'PLATFORM' AND p.pitch_status = 'PUBLISHED' THEN 1 ELSE 0 END) AS hasPublishedPlatformPitch,
            MAX(p.pitch_id) AS pitchId,
            MAX(p.original_ask_amount) AS originalAskAmount,
            MAX(p.original_ask_equity_pct) AS originalAskEquityPct,
            MAX(p.pitch_hook) AS pitchHook
     FROM company c LEFT JOIN industry i ON i.industry_id = c.industry_id
     LEFT JOIN startup_stage st ON st.stage_id = c.stage_id
     LEFT JOIN pitch p ON p.company_id = c.company_id
     WHERE c.company_id IN (${marks}) GROUP BY c.company_id`, ids,
  );
  if (rows.length !== ids.length) fail(404, 'STARTUP_NOT_FOUND', 'One or more startups were not found.');
  const sources = rows.map(row => String(row.sourceTypes ?? '').split(',').filter(Boolean));
  if (sources.some(value => value.length !== 1)) fail(409, 'AMBIGUOUS_COMPARISON_SOURCE', 'Each startup must have exactly one stored source type to be compared.');
  const sourceType = sources[0][0];
  if (!sources.every(value => value[0] === sourceType)) fail(400, 'MIXED_COMPARISON_SOURCES', 'Historical startups and platform listings cannot be compared together.');
  if (sourceType !== 'SHOW' && sourceType !== 'PLATFORM') fail(409, 'UNCLASSIFIED_STARTUP', 'A comparison item has no eligible stored pitch source.');
  if (sourceType === 'PLATFORM' && rows.some(row => Number(row.hasPublishedPlatformPitch) !== 1)) {
    fail(404, 'PLATFORM_LISTING_NOT_PUBLISHED', 'Only published platform listings are eligible for comparison.');
  }
  const order = new Map(ids.map((id, index) => [id, index]));
  rows.sort((a, b) => (order.get(Number(a.companyId)) ?? 0) - (order.get(Number(b.companyId)) ?? 0));
  return { sourceType, items: rows };
}

export async function getHistoricalStatistics() {
  const [seasonRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT s.season_id AS seasonId, s.season_number AS seasonNumber,
            s.country_franchise AS countryFranchise,
            COUNT(DISTINCT p.pitch_id) AS pitchCount,
            SUM(CASE WHEN d.deal_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completedDeals,
            SUM(CASE WHEN d.deal_status = 'FELL_THROUGH' THEN 1 ELSE 0 END) AS fellThroughDeals,
            SUM(CASE WHEN d.deal_status = 'PENDING_DUE_DILIGENCE' THEN 1 ELSE 0 END) AS pendingDeals,
            SUM(CASE WHEN d.deal_id IS NULL THEN 1 ELSE 0 END) AS noRecordedOutcome
     FROM show_season s LEFT JOIN show_episode e ON e.season_id = s.season_id
     LEFT JOIN pitch p ON p.episode_id = e.episode_id AND p.pitch_type = 'SHOW'
     LEFT JOIN closed_deal d ON d.pitch_id = p.pitch_id
     GROUP BY s.season_id, s.season_number, s.country_franchise
     ORDER BY s.country_franchise, s.season_number`,
  );
  const [sectorRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT i.industry_id AS industryId, i.industry_name AS industryName,
            COUNT(DISTINCT p.pitch_id) AS pitchCount,
            SUM(CASE WHEN d.deal_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completedDeals,
            SUM(CASE WHEN d.deal_status = 'FELL_THROUGH' THEN 1 ELSE 0 END) AS fellThroughDeals,
            SUM(CASE WHEN d.deal_id IS NULL THEN 1 ELSE 0 END) AS noRecordedOutcome
     FROM industry i JOIN company c ON c.industry_id = i.industry_id
     JOIN pitch p ON p.company_id = c.company_id AND p.pitch_type = 'SHOW'
     LEFT JOIN closed_deal d ON d.pitch_id = p.pitch_id
     GROUP BY i.industry_id, i.industry_name ORDER BY pitchCount DESC, i.industry_name`,
  );
  const [sharkRows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT sh.shark_id AS sharkId, i.display_name AS displayName,
            COUNT(DISTINCT seat.episode_id) AS episodesAppeared,
            COUNT(DISTINCT p.pitch_id) AS pitchesSeen,
            COUNT(DISTINCT CASE WHEN d.deal_status = 'COMPLETED' THEN p.pitch_id END) AS completedDealsAssociated
     FROM shark sh JOIN investor i ON i.investor_id = sh.investor_id
     LEFT JOIN episode_shark_seat seat ON seat.shark_id = sh.shark_id
     LEFT JOIN show_episode e ON e.episode_id = seat.episode_id
     LEFT JOIN pitch p ON p.episode_id = e.episode_id AND p.pitch_type = 'SHOW'
     LEFT JOIN closed_deal d ON d.pitch_id = p.pitch_id
     GROUP BY sh.shark_id, i.display_name ORDER BY episodesAppeared DESC, i.display_name`,
  );
  return { dealsBySeason: seasonRows, sectorDistribution: sectorRows, sharkActivity: sharkRows };
}

export async function createHistoricalSeason(payload: unknown) {
  const b = objectBody(payload);
  const seasonNumber = optionalNumber(b, 'seasonNumber', { required: true, integer: true, min: 1 }) as number;
  const countryFranchise = (optionalText(b, 'countryFranchise', 100) ?? 'India') as string;
  const premiereDate = optionalDate(b, 'premiereDate') ?? null;
  const finaleDate = optionalDate(b, 'finaleDate') ?? null;
  if (premiereDate && finaleDate && finaleDate < premiereDate) fail(400, 'INVALID_DATE_RANGE', 'finaleDate cannot be earlier than premiereDate.');
  const totalEpisodes = optionalNumber(b, 'totalEpisodes', { integer: true, min: 0 }) ?? null;
  const networkChannel = optionalText(b, 'networkChannel', 150) ?? null;
  const productionHouse = optionalText(b, 'productionHouse', 180) ?? null;
  const budgetAmount = optionalNumber(b, 'budgetAmount', { min: 0 }) ?? null;
  try {
    const [result] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO show_season (season_number, country_franchise, premiere_date, finale_date, total_episodes, network_channel, production_house, budget_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [seasonNumber, countryFranchise, premiereDate, finaleDate, totalEpisodes, networkChannel, productionHouse, budgetAmount],
    );
    return { seasonId: result.insertId };
  } catch (error) { mapDbError(error); }
}

export async function updateHistoricalSeason(seasonIdValue: unknown, payload: unknown) {
  const seasonId = positiveId(seasonIdValue, 'seasonId');
  const b = objectBody(payload);
  const fields: Array<[string, string, SqlInputValue]> = [];
  const seasonNumber = optionalNumber(b, 'seasonNumber', { integer: true, min: 1 });
  if (seasonNumber !== undefined) fields.push(['season_number', 'number', seasonNumber]);
  const country = optionalText(b, 'countryFranchise', 100);
  if (country !== undefined) fields.push(['country_franchise', 'text', country]);
  const premiere = optionalDate(b, 'premiereDate');
  if (premiere !== undefined) fields.push(['premiere_date', 'date', premiere]);
  const finale = optionalDate(b, 'finaleDate');
  if (finale !== undefined) fields.push(['finale_date', 'date', finale]);
  const totalEpisodes = optionalNumber(b, 'totalEpisodes', { integer: true, min: 0 });
  if (totalEpisodes !== undefined) fields.push(['total_episodes', 'number', totalEpisodes]);
  const network = optionalText(b, 'networkChannel', 150);
  if (network !== undefined) fields.push(['network_channel', 'text', network]);
  const production = optionalText(b, 'productionHouse', 180);
  if (production !== undefined) fields.push(['production_house', 'text', production]);
  const budget = optionalNumber(b, 'budgetAmount', { min: 0 });
  if (budget !== undefined) fields.push(['budget_amount', 'number', budget]);
  if (!fields.length) fail(400, 'NO_FIELDS', 'Provide at least one editable season field.');
  const [existing] = await dbPool.execute<RowDataPacket[]>('SELECT * FROM show_season WHERE season_id = ?', [seasonId]);
  if (!existing.length) fail(404, 'SEASON_NOT_FOUND', 'Historical season not found.');
  const valueByColumn = new Map(fields.map(([column, , value]) => [column, value]));
  const rawPremiere = valueByColumn.has('premiere_date') ? valueByColumn.get('premiere_date') : existing[0].premiere_date;
  const rawFinale = valueByColumn.has('finale_date') ? valueByColumn.get('finale_date') : existing[0].finale_date;
  const finalPremiere = normalizeDateValue(rawPremiere);
  const finalFinale = normalizeDateValue(rawFinale);
  if (finalPremiere && finalFinale && finalFinale < finalPremiere) fail(400, 'INVALID_DATE_RANGE', 'finaleDate cannot be earlier than premiereDate.');
  try {
    await dbPool.execute(`UPDATE show_season SET ${fields.map(([col]) => `${col} = ?`).join(', ')} WHERE season_id = ?`, [...fields.map(([, , value]) => value), seasonId]);
    return { seasonId };
  } catch (error) { mapDbError(error); }
}

export async function deleteHistoricalSeason(seasonIdValue: unknown) {
  const seasonId = positiveId(seasonIdValue, 'seasonId');
  try {
    const [result] = await dbPool.execute<ResultSetHeader>('DELETE FROM show_season WHERE season_id = ?', [seasonId]);
    if (!result.affectedRows) fail(404, 'SEASON_NOT_FOUND', 'Historical season not found.');
    return { deleted: true, seasonId };
  } catch (error) { mapDbError(error); }
}

export async function createHistoricalEpisode(payload: unknown) {
  const b = objectBody(payload);
  const seasonId = positiveId(b.seasonId, 'seasonId');
  const episodeNumber = optionalNumber(b, 'episodeNumber', { required: true, integer: true, min: 1 }) as number;
  const title = optionalText(b, 'episodeTitle', 200) ?? null;
  const tapeDate = optionalDate(b, 'tapeDate') ?? null;
  const airDate = optionalDate(b, 'airDate') ?? null;
  const duration = optionalNumber(b, 'durationMinutes', { integer: true, min: 1 }) ?? null;
  const rating = optionalNumber(b, 'tvRating', { min: 0 }) ?? null;
  const viewers = optionalNumber(b, 'viewersCountMillions', { min: 0 }) ?? null;
  const location = optionalText(b, 'filmingLocation', 200) ?? null;
  const videoUrl = optionalText(b, 'videoUrl', 1000) ?? null;
  const [season] = await dbPool.execute<RowDataPacket[]>('SELECT season_id FROM show_season WHERE season_id = ?', [seasonId]);
  if (!season.length) fail(400, 'INVALID_REFERENCE', 'seasonId does not exist.');
  try {
    const [result] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO show_episode (season_id, episode_number, episode_title, tape_date, air_date, duration_minutes, tv_rating, viewers_count_millions, filming_location, video_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [seasonId, episodeNumber, title, tapeDate, airDate, duration, rating, viewers, location, videoUrl],
    );
    return { episodeId: result.insertId };
  } catch (error) { mapDbError(error); }
}

export async function updateHistoricalEpisode(episodeIdValue: unknown, payload: unknown) {
  const episodeId = positiveId(episodeIdValue, 'episodeId');
  const b = objectBody(payload);
  const fields: Array<[string, SqlInputValue]> = [];
  for (const [key, column, max] of [['episodeTitle', 'episode_title', 200], ['filmingLocation', 'filming_location', 200], ['videoUrl', 'video_url', 1000]] as const) {
    const value = optionalText(b, key, max);
    if (value !== undefined) fields.push([column, value]);
  }
  const episodeNumber = optionalNumber(b, 'episodeNumber', { integer: true, min: 1 });
  if (episodeNumber !== undefined) fields.push(['episode_number', episodeNumber]);
  for (const [key, column] of [['tapeDate', 'tape_date'], ['airDate', 'air_date']] as const) {
    const value = optionalDate(b, key);
    if (value !== undefined) fields.push([column, value]);
  }
  for (const [key, column, integer, min] of [['durationMinutes', 'duration_minutes', true, 1], ['tvRating', 'tv_rating', false, 0], ['viewersCountMillions', 'viewers_count_millions', false, 0]] as const) {
    const value = optionalNumber(b, key, { integer, min });
    if (value !== undefined) fields.push([column, value]);
  }
  if ('seasonId' in b) {
    const value = positiveId(b.seasonId, 'seasonId');
    const [season] = await dbPool.execute<RowDataPacket[]>('SELECT season_id FROM show_season WHERE season_id = ?', [value]);
    if (!season.length) fail(400, 'INVALID_REFERENCE', 'seasonId does not exist.');
    fields.push(['season_id', value]);
  }
  if (!fields.length) fail(400, 'NO_FIELDS', 'Provide at least one editable episode field.');
  try {
    const [result] = await dbPool.execute<ResultSetHeader>(`UPDATE show_episode SET ${fields.map(([column]) => `${column} = ?`).join(', ')} WHERE episode_id = ?`, [...fields.map(([, value]) => value), episodeId]);
    if (!result.affectedRows) {
      const [exists] = await dbPool.execute<RowDataPacket[]>('SELECT episode_id FROM show_episode WHERE episode_id = ?', [episodeId]);
      if (!exists.length) fail(404, 'EPISODE_NOT_FOUND', 'Historical episode not found.');
    }
    return { episodeId };
  } catch (error) { mapDbError(error); }
}

export async function deleteHistoricalEpisode(episodeIdValue: unknown) {
  const episodeId = positiveId(episodeIdValue, 'episodeId');
  try {
    const [result] = await dbPool.execute<ResultSetHeader>('DELETE FROM show_episode WHERE episode_id = ?', [episodeId]);
    if (!result.affectedRows) fail(404, 'EPISODE_NOT_FOUND', 'Historical episode not found.');
    return { deleted: true, episodeId };
  } catch (error) { mapDbError(error); }
}

export async function createHistoricalPitch(payload: unknown) {
  const b = objectBody(payload);
  const brandName = optionalText(b, 'brandName', 150, true) as string;
  const industryId = positiveId(b.industryId, 'industryId');
  const episodeId = positiveId(b.episodeId, 'episodeId');
  const sequence = optionalNumber(b, 'pitchSequenceOrder', { required: true, integer: true, min: 1 }) as number;
  const [industry] = await dbPool.execute<RowDataPacket[]>('SELECT industry_id FROM industry WHERE industry_id = ?', [industryId]);
  if (!industry.length) fail(400, 'INVALID_REFERENCE', 'industryId does not exist.');
  const [episode] = await dbPool.execute<RowDataPacket[]>('SELECT episode_id FROM show_episode WHERE episode_id = ?', [episodeId]);
  if (!episode.length) fail(400, 'INVALID_REFERENCE', 'episodeId does not exist.');
  let stageId: number | null = null;
  if (b.stageId !== undefined && b.stageId !== null) {
    stageId = positiveId(b.stageId, 'stageId');
    const [stage] = await dbPool.execute<RowDataPacket[]>('SELECT stage_id FROM startup_stage WHERE stage_id = ?', [stageId]);
    if (!stage.length) fail(400, 'INVALID_REFERENCE', 'stageId does not exist.');
  }
  const companyFields = {
    legalBusinessName: optionalText(b, 'legalBusinessName', 200) ?? null,
    businessModel: optionalText(b, 'businessModel', 100) ?? null,
    websiteUrl: optionalText(b, 'websiteUrl', 500) ?? null,
    foundedYear: optionalNumber(b, 'foundedYear', { integer: true, min: 1800, max: 2100 }) ?? null,
    headquartersCity: optionalText(b, 'headquartersCity', 100) ?? null,
    headquartersState: optionalText(b, 'headquartersState', 100) ?? null,
    headquartersCountry: optionalText(b, 'headquartersCountry', 100) ?? 'India',
  };
  const ask = optionalNumber(b, 'originalAskAmount', { min: 0 }) ?? null;
  const equity = optionalNumber(b, 'originalAskEquityPct', { min: 0.01, max: 100 }) ?? null;
  const hook = optionalText(b, 'pitchHook', 10000) ?? null;
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const [company] = await conn.execute<ResultSetHeader>(
      `INSERT INTO company (brand_name, legal_business_name, industry_id, stage_id, business_model, website_url, founded_year, headquarters_city, headquarters_state, headquarters_country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [brandName, companyFields.legalBusinessName, industryId, stageId, companyFields.businessModel, companyFields.websiteUrl, companyFields.foundedYear, companyFields.headquartersCity, companyFields.headquartersState, companyFields.headquartersCountry],
    );
    const [pitch] = await conn.execute<ResultSetHeader>(
      `INSERT INTO pitch (company_id, pitch_type, episode_id, submitted_by_user_id, pitch_sequence_order, original_ask_amount, original_ask_equity_pct, pitch_hook, pitch_status)
       VALUES (?, 'SHOW', ?, NULL, ?, ?, ?, ?, 'PUBLISHED')`,
      [company.insertId, episodeId, sequence, ask, equity, hook],
    );
    await conn.commit();
    return { pitchId: pitch.insertId, companyId: company.insertId };
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    mapDbError(error);
  } finally { conn.release(); }
}

export async function updateHistoricalPitch(pitchIdValue: unknown, payload: unknown) {
  const pitchId = positiveId(pitchIdValue, 'pitchId');
  const b = objectBody(payload);
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT p.pitch_id AS pitchId, p.company_id AS companyId, p.pitch_type AS pitchType,
              p.episode_id AS episodeId, p.pitch_sequence_order AS pitchSequenceOrder,
              c.industry_id AS industryId, c.stage_id AS stageId
       FROM pitch p JOIN company c ON c.company_id = p.company_id WHERE p.pitch_id = ? FOR UPDATE`, [pitchId],
    );
    if (!rows.length) { await conn.rollback(); fail(404, 'PITCH_NOT_FOUND', 'Historical pitch not found.'); }
    const row = rows[0];
    if (row.pitchType !== 'SHOW') { await conn.rollback(); fail(409, 'NOT_HISTORICAL_PITCH', 'Only SHOW historical pitches can be edited through this endpoint.'); }
    const companyFields: Array<[string, SqlInputValue]> = [];
    for (const [key, column, max] of [['brandName', 'brand_name', 150], ['legalBusinessName', 'legal_business_name', 200], ['businessModel', 'business_model', 100], ['websiteUrl', 'website_url', 500], ['headquartersCity', 'headquarters_city', 100], ['headquartersState', 'headquarters_state', 100], ['headquartersCountry', 'headquarters_country', 100]] as const) {
      const value = optionalText(b, key, max, key === 'brandName');
      if (value !== undefined) companyFields.push([column, value]);
    }
    if ('industryId' in b) {
      const id = positiveId(b.industryId, 'industryId');
      const [found] = await conn.execute<RowDataPacket[]>('SELECT industry_id FROM industry WHERE industry_id = ?', [id]);
      if (!found.length) { await conn.rollback(); fail(400, 'INVALID_REFERENCE', 'industryId does not exist.'); }
      companyFields.push(['industry_id', id]);
    }
    if ('stageId' in b) {
      const stageId = b.stageId === null ? null : positiveId(b.stageId, 'stageId');
      if (stageId !== null) {
        const [found] = await conn.execute<RowDataPacket[]>('SELECT stage_id FROM startup_stage WHERE stage_id = ?', [stageId]);
        if (!found.length) { await conn.rollback(); fail(400, 'INVALID_REFERENCE', 'stageId does not exist.'); }
      }
      companyFields.push(['stage_id', stageId]);
    }
    if ('foundedYear' in b) {
      const foundedYear = optionalNumber(b, 'foundedYear', { integer: true, min: 1800, max: 2100 });
      if (foundedYear !== undefined) companyFields.push(['founded_year', foundedYear]);
    }
    if (companyFields.length) await conn.execute(`UPDATE company SET ${companyFields.map(([col]) => `${col} = ?`).join(', ')} WHERE company_id = ?`, [...companyFields.map(([, value]) => value), row.companyId]);

    const pitchFields: Array<[string, SqlInputValue]> = [];
    if ('episodeId' in b) {
      const episodeId = positiveId(b.episodeId, 'episodeId');
      const [found] = await conn.execute<RowDataPacket[]>('SELECT episode_id FROM show_episode WHERE episode_id = ?', [episodeId]);
      if (!found.length) { await conn.rollback(); fail(400, 'INVALID_REFERENCE', 'episodeId does not exist.'); }
      pitchFields.push(['episode_id', episodeId]);
    }
    if ('pitchSequenceOrder' in b) pitchFields.push(['pitch_sequence_order', positiveId(b.pitchSequenceOrder, 'pitchSequenceOrder')]);
    if ('originalAskAmount' in b) {
      const value = optionalNumber(b, 'originalAskAmount', { min: 0 });
      if (value !== undefined) pitchFields.push(['original_ask_amount', value]);
    }
    if ('originalAskEquityPct' in b) {
      const value = optionalNumber(b, 'originalAskEquityPct', { min: 0.01, max: 100 });
      if (value !== undefined) pitchFields.push(['original_ask_equity_pct', value]);
    }
    if ('pitchHook' in b) {
      const value = optionalText(b, 'pitchHook', 10000);
      if (value !== undefined) pitchFields.push(['pitch_hook', value]);
    }
    if (!companyFields.length && !pitchFields.length) { await conn.rollback(); fail(400, 'NO_FIELDS', 'Provide at least one editable historical pitch field.'); }
    if (pitchFields.length) await conn.execute(`UPDATE pitch SET ${pitchFields.map(([col]) => `${col} = ?`).join(', ')} WHERE pitch_id = ?`, [...pitchFields.map(([, value]) => value), pitchId]);
    await conn.commit();
    return { pitchId, companyId: Number(row.companyId) };
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    mapDbError(error);
  } finally { conn.release(); }
}

export async function deleteHistoricalPitch(pitchIdValue: unknown) {
  const pitchId = positiveId(pitchIdValue, 'pitchId');
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<RowDataPacket[]>(`SELECT pitch_id AS pitchId, company_id AS companyId, pitch_type AS pitchType FROM pitch WHERE pitch_id = ? FOR UPDATE`, [pitchId]);
    if (!rows.length) { await conn.rollback(); fail(404, 'PITCH_NOT_FOUND', 'Historical pitch not found.'); }
    if (rows[0].pitchType !== 'SHOW') { await conn.rollback(); fail(409, 'NOT_HISTORICAL_PITCH', 'Only SHOW historical pitches can be deleted through this endpoint.'); }
    await conn.execute('DELETE FROM pitch WHERE pitch_id = ?', [pitchId]);
    await conn.execute('DELETE FROM company WHERE company_id = ?', [rows[0].companyId]);
    await conn.commit();
    return { deleted: true, pitchId };
  } catch (error) { await conn.rollback().catch(() => undefined); mapDbError(error); }
  finally { conn.release(); }
}

export async function createHistoricalShark(payload: unknown) {
  const b = objectBody(payload);
  const displayName = optionalText(b, 'displayName', 150, true) as string;
  const parts = displayName.split(/\s+/);
  const firstName = parts.shift() || displayName;
  const lastName = parts.join(' ') || null;
  const firm = optionalText(b, 'investmentFirmName', 180) ?? null;
  const stageName = optionalText(b, 'stageName', 150) ?? null;
  const gender = optionalText(b, 'gender', 30) ?? null;
  const birthDate = optionalDate(b, 'birthDate') ?? null;
  const guest = b.isGuestShark === undefined ? false : b.isGuestShark;
  if (typeof guest !== 'boolean') fail(400, 'INVALID_INPUT', 'isGuestShark must be a boolean.');
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const [investor] = await conn.execute<ResultSetHeader>(
      `INSERT INTO investor (user_id, first_name, last_name, display_name, investment_firm_name) VALUES (NULL, ?, ?, ?, ?)`,
      [firstName, lastName, displayName, firm],
    );
    const [shark] = await conn.execute<ResultSetHeader>(
      `INSERT INTO shark (investor_id, stage_name, gender, birth_date, is_guest_shark) VALUES (?, ?, ?, ?, ?)`,
      [investor.insertId, stageName, gender, birthDate, guest ? 1 : 0],
    );
    await conn.commit();
    return { sharkId: shark.insertId };
  } catch (error) { await conn.rollback().catch(() => undefined); mapDbError(error); }
  finally { conn.release(); }
}

export async function updateHistoricalShark(sharkIdValue: unknown, payload: unknown) {
  const sharkId = positiveId(sharkIdValue, 'sharkId');
  const b = objectBody(payload);
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT sh.shark_id AS sharkId, sh.investor_id AS investorId, i.user_id AS userId
       FROM shark sh JOIN investor i ON i.investor_id = sh.investor_id WHERE sh.shark_id = ? FOR UPDATE`, [sharkId],
    );
    if (!rows.length) { await conn.rollback(); fail(404, 'SHARK_NOT_FOUND', 'Historical Shark not found.'); }
    if (rows[0].userId !== null) { await conn.rollback(); fail(409, 'NOT_HISTORICAL_SHARK', 'This Shark is linked to a platform user and cannot be edited as a historical-only record.'); }
    const investorId = Number(rows[0].investorId);
    const investorSets: string[] = [];
    const investorParams: SqlInputValue[] = [];
    if ('displayName' in b) {
      const name = optionalText(b, 'displayName', 150, true) as string;
      const parts = name.split(/\s+/); const first = parts.shift() || name; const last = parts.join(' ') || null;
      investorSets.push('display_name = ?', 'first_name = ?', 'last_name = ?'); investorParams.push(name, first, last);
    }
    if ('investmentFirmName' in b) {
      const value = optionalText(b, 'investmentFirmName', 180);
      if (value !== undefined) { investorSets.push('investment_firm_name = ?'); investorParams.push(value); }
    }
    if (investorSets.length) await conn.execute(`UPDATE investor SET ${investorSets.join(', ')} WHERE investor_id = ?`, [...investorParams, investorId]);
    const sharkSets: string[] = []; const sharkParams: SqlInputValue[] = [];
    if ('stageName' in b) {
      const value = optionalText(b, 'stageName', 150);
      if (value !== undefined) { sharkSets.push('stage_name = ?'); sharkParams.push(value); }
    }
    if ('gender' in b) {
      const value = optionalText(b, 'gender', 30);
      if (value !== undefined) { sharkSets.push('gender = ?'); sharkParams.push(value); }
    }
    if ('birthDate' in b) {
      const value = optionalDate(b, 'birthDate');
      if (value !== undefined) { sharkSets.push('birth_date = ?'); sharkParams.push(value); }
    }
    if ('isGuestShark' in b) {
      if (typeof b.isGuestShark !== 'boolean') { await conn.rollback(); fail(400, 'INVALID_INPUT', 'isGuestShark must be a boolean.'); }
      sharkSets.push('is_guest_shark = ?'); sharkParams.push(b.isGuestShark ? 1 : 0);
    }
    if (!investorSets.length && !sharkSets.length) { await conn.rollback(); fail(400, 'NO_FIELDS', 'Provide at least one editable Shark field.'); }
    if (sharkSets.length) await conn.execute(`UPDATE shark SET ${sharkSets.join(', ')} WHERE shark_id = ?`, [...sharkParams, sharkId]);
    await conn.commit();
    return { sharkId };
  } catch (error) { await conn.rollback().catch(() => undefined); mapDbError(error); }
  finally { conn.release(); }
}

export async function deleteHistoricalShark(sharkIdValue: unknown) {
  const sharkId = positiveId(sharkIdValue, 'sharkId');
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<RowDataPacket[]>(`SELECT sh.investor_id AS investorId, i.user_id AS userId FROM shark sh JOIN investor i ON i.investor_id = sh.investor_id WHERE sh.shark_id = ? FOR UPDATE`, [sharkId]);
    if (!rows.length) { await conn.rollback(); fail(404, 'SHARK_NOT_FOUND', 'Historical Shark not found.'); }
    if (rows[0].userId !== null) { await conn.rollback(); fail(409, 'NOT_HISTORICAL_SHARK', 'This Shark is linked to a platform user and cannot be deleted as a historical-only record.'); }
    const investorId = Number(rows[0].investorId);
    await conn.execute('DELETE FROM shark WHERE shark_id = ?', [sharkId]);
    await conn.execute('DELETE FROM investor WHERE investor_id = ? AND user_id IS NULL', [investorId]);
    await conn.commit();
    return { deleted: true, sharkId };
  } catch (error) { await conn.rollback().catch(() => undefined); mapDbError(error); }
  finally { conn.release(); }
}

export async function assignHistoricalEpisodeSharkSeat(episodeIdValue: unknown, sharkIdValue: unknown, payload: unknown) {
  const episodeId = positiveId(episodeIdValue, 'episodeId');
  const sharkId = positiveId(sharkIdValue, 'sharkId');
  const b = objectBody(payload);
  const chairPositionNumber = optionalNumber(b, 'chairPositionNumber', { required: true, integer: true, min: 1 }) as number;
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const [episode] = await conn.execute<RowDataPacket[]>('SELECT episode_id FROM show_episode WHERE episode_id = ? FOR UPDATE', [episodeId]);
    if (!episode.length) { await conn.rollback(); fail(404, 'EPISODE_NOT_FOUND', 'Historical episode not found.'); }
    const [shark] = await conn.execute<RowDataPacket[]>(
      `SELECT sh.shark_id AS sharkId, i.user_id AS userId FROM shark sh JOIN investor i ON i.investor_id = sh.investor_id WHERE sh.shark_id = ? FOR UPDATE`,
      [sharkId],
    );
    if (!shark.length) { await conn.rollback(); fail(404, 'SHARK_NOT_FOUND', 'Historical Shark not found.'); }
    if (shark[0].userId !== null) { await conn.rollback(); fail(409, 'NOT_HISTORICAL_SHARK', 'Only historical-only Shark records can be assigned to a television episode.'); }
    await conn.execute(
      `INSERT INTO episode_shark_seat (episode_id, shark_id, chair_position_number) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE chair_position_number = VALUES(chair_position_number)`,
      [episodeId, sharkId, chairPositionNumber],
    );
    await conn.commit();
    return { episodeId, sharkId, chairPositionNumber };
  } catch (error) { await conn.rollback().catch(() => undefined); mapDbError(error); }
  finally { conn.release(); }
}

export async function removeHistoricalEpisodeSharkSeat(episodeIdValue: unknown, sharkIdValue: unknown) {
  const episodeId = positiveId(episodeIdValue, 'episodeId');
  const sharkId = positiveId(sharkIdValue, 'sharkId');
  const [result] = await dbPool.execute<ResultSetHeader>(
    'DELETE FROM episode_shark_seat WHERE episode_id = ? AND shark_id = ?', [episodeId, sharkId],
  );
  if (!result.affectedRows) fail(404, 'EPISODE_SHARK_SEAT_NOT_FOUND', 'The Shark is not assigned to this episode.');
  return { deleted: true, episodeId, sharkId };
}

export async function createHistoricalOffer(payload: unknown) {
  const b = objectBody(payload);
  const pitchId = positiveId(b.pitchId, 'pitchId');
  const sharkId = positiveId(b.sharkId, 'sharkId');
  const roundNumber = optionalNumber(b, 'roundNumber', { required: true, integer: true, min: 1 }) as number;
  const [pitchRows] = await dbPool.execute<RowDataPacket[]>("SELECT pitch_id FROM pitch WHERE pitch_id = ? AND pitch_type = 'SHOW'", [pitchId]);
  if (!pitchRows.length) fail(404, 'HISTORICAL_PITCH_NOT_FOUND', 'Historical SHOW pitch not found.');
  const [sharks] = await dbPool.execute<RowDataPacket[]>('SELECT investor_id AS investorId FROM shark WHERE shark_id = ?', [sharkId]);
  if (!sharks.length) fail(400, 'INVALID_REFERENCE', 'sharkId does not exist.');
  const status = b.offerStatus ?? 'PROPOSED';
  if (!['PROPOSED', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(String(status))) fail(400, 'INVALID_INPUT', 'offerStatus is invalid.');
  const fields = [
    ['amountOffered', 'amount_offered', 0], ['equityRequestedPct', 'equity_requested_pct', 0],
    ['royaltyPerUnit', 'royalty_per_unit', 0], ['royaltyCapAmount', 'royalty_cap_amount', 0],
    ['loanAmount', 'loan_amount', 0], ['loanInterestRatePct', 'loan_interest_rate_pct', 0], ['advisorySharesPct', 'advisory_shares_pct', 0],
  ] as const;
  const values: Record<string, number | null> = {};
  for (const [key] of fields) {
    const value = optionalNumber(b, key, { min: key === 'equityRequestedPct' || key === 'advisorySharesPct' ? 0 : 0, max: key === 'equityRequestedPct' || key === 'advisorySharesPct' ? 100 : undefined });
    values[key] = value === undefined ? null : value;
  }
  const counter = b.isCounterOffer === undefined ? false : b.isCounterOffer;
  const shotClock = b.shotClockApplied === undefined ? false : b.shotClockApplied;
  if (typeof counter !== 'boolean' || typeof shotClock !== 'boolean') fail(400, 'INVALID_INPUT', 'isCounterOffer and shotClockApplied must be booleans.');
  try {
    const [result] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO offer (pitch_id, round_number, is_counter_offer, created_by_founder_id, created_by_investor_id,
        amount_offered, equity_requested_pct, royalty_per_unit, royalty_cap_amount, loan_amount,
        loan_interest_rate_pct, advisory_shares_pct, shot_clock_applied, offer_status)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pitchId, roundNumber, counter ? 1 : 0, sharks[0].investorId, values.amountOffered, values.equityRequestedPct,
        values.royaltyPerUnit, values.royaltyCapAmount, values.loanAmount, values.loanInterestRatePct,
        values.advisorySharesPct, shotClock ? 1 : 0, status],
    );
    return { offerId: result.insertId };
  } catch (error) { mapDbError(error); }
}

export async function updateHistoricalOffer(offerIdValue: unknown, payload: unknown) {
  const offerId = positiveId(offerIdValue, 'offerId');
  const b = objectBody(payload);
  const [existing] = await dbPool.execute<RowDataPacket[]>(`SELECT o.offer_id AS offerId, o.pitch_id AS pitchId, p.pitch_type AS pitchType FROM offer o JOIN pitch p ON p.pitch_id = o.pitch_id WHERE o.offer_id = ?`, [offerId]);
  if (!existing.length) fail(404, 'OFFER_NOT_FOUND', 'Historical offer not found.');
  if (existing[0].pitchType !== 'SHOW') fail(409, 'NOT_HISTORICAL_OFFER', 'Only offers attached to historical SHOW pitches can be edited here.');
  const fields: Array<[string, SqlInputValue]> = [];
  if ('roundNumber' in b) {
    const value = optionalNumber(b, 'roundNumber', { integer: true, min: 1 });
    if (value !== undefined) fields.push(['round_number', value]);
  }
  for (const [key, column, max] of [['amountOffered', 'amount_offered', undefined], ['equityRequestedPct', 'equity_requested_pct', 100], ['royaltyPerUnit', 'royalty_per_unit', undefined], ['royaltyCapAmount', 'royalty_cap_amount', undefined], ['loanAmount', 'loan_amount', undefined], ['loanInterestRatePct', 'loan_interest_rate_pct', undefined], ['advisorySharesPct', 'advisory_shares_pct', 100]] as const) {
    if (key in b) {
      const value = optionalNumber(b, key, { min: 0, max });
      if (value !== undefined) fields.push([column, value]);
    }
  }
  if ('offerStatus' in b) {
    if (!['PROPOSED', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(String(b.offerStatus))) fail(400, 'INVALID_INPUT', 'offerStatus is invalid.');
    fields.push(['offer_status', String(b.offerStatus)]);
  }
  if ('isCounterOffer' in b) { if (typeof b.isCounterOffer !== 'boolean') fail(400, 'INVALID_INPUT', 'isCounterOffer must be boolean.'); fields.push(['is_counter_offer', b.isCounterOffer ? 1 : 0]); }
  if ('shotClockApplied' in b) { if (typeof b.shotClockApplied !== 'boolean') fail(400, 'INVALID_INPUT', 'shotClockApplied must be boolean.'); fields.push(['shot_clock_applied', b.shotClockApplied ? 1 : 0]); }
  if (!fields.length) fail(400, 'NO_FIELDS', 'Provide at least one editable offer field.');
  try { await dbPool.execute(`UPDATE offer SET ${fields.map(([column]) => `${column} = ?`).join(', ')} WHERE offer_id = ?`, [...fields.map(([, value]) => value), offerId]); return { offerId }; }
  catch (error) { mapDbError(error); }
}

export async function deleteHistoricalOffer(offerIdValue: unknown) {
  const offerId = positiveId(offerIdValue, 'offerId');
  try {
    const [rows] = await dbPool.execute<RowDataPacket[]>(`SELECT o.offer_id AS offerId, p.pitch_type AS pitchType FROM offer o JOIN pitch p ON p.pitch_id = o.pitch_id WHERE o.offer_id = ?`, [offerId]);
    if (!rows.length) fail(404, 'OFFER_NOT_FOUND', 'Historical offer not found.');
    if (rows[0].pitchType !== 'SHOW') fail(409, 'NOT_HISTORICAL_OFFER', 'Only offers attached to historical SHOW pitches can be deleted here.');
    const [result] = await dbPool.execute<ResultSetHeader>('DELETE FROM offer WHERE offer_id = ?', [offerId]);
    if (!result.affectedRows) fail(404, 'OFFER_NOT_FOUND', 'Historical offer not found.');
    return { deleted: true, offerId };
  } catch (error) { mapDbError(error); }
}

export async function upsertHistoricalDeal(payload: unknown, actorUserId: number) {
  const b = objectBody(payload);
  const pitchId = positiveId(b.pitchId, 'pitchId');
  const offerId = positiveId(b.offerId, 'offerId');
  const amount = optionalNumber(b, 'finalAgreedAmount', { required: true, min: 0 }) as number;
  const equity = optionalNumber(b, 'finalAgreedEquityPct', { min: 0, max: 100 }) ?? null;
  const terms = optionalText(b, 'contingencyTerms', 10000) ?? null;
  const statusValue = b.dealStatus ?? 'PENDING_DUE_DILIGENCE';
  if (typeof statusValue !== 'string' || !['PENDING_DUE_DILIGENCE', 'COMPLETED', 'FELL_THROUGH'].includes(statusValue)) {
    fail(400, 'INVALID_INPUT', 'dealStatus is invalid.');
  }
  const status: 'PENDING_DUE_DILIGENCE' | 'COMPLETED' | 'FELL_THROUGH' = statusValue as 'PENDING_DUE_DILIGENCE' | 'COMPLETED' | 'FELL_THROUGH';
  let handshakeTime: string | null = null;
  if (b.handshakeTime !== undefined && b.handshakeTime !== null && b.handshakeTime !== '') {
    if (typeof b.handshakeTime !== 'string' || !/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/.test(b.handshakeTime)) {
      fail(400, 'INVALID_INPUT', 'handshakeTime must be YYYY-MM-DD or YYYY-MM-DD HH:mm:ss.');
    }
    handshakeTime = b.handshakeTime;
  }
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const [pitchRows] = await conn.execute<RowDataPacket[]>("SELECT pitch_id FROM pitch WHERE pitch_id = ? AND pitch_type = 'SHOW' FOR UPDATE", [pitchId]);
    if (!pitchRows.length) { await conn.rollback(); fail(404, 'HISTORICAL_PITCH_NOT_FOUND', 'Historical SHOW pitch not found.'); }
    const [offerRows] = await conn.execute<RowDataPacket[]>("SELECT offer_id FROM offer WHERE offer_id = ? AND pitch_id = ? FOR UPDATE", [offerId, pitchId]);
    if (!offerRows.length) { await conn.rollback(); fail(400, 'INVALID_REFERENCE', 'offerId must belong to the selected historical pitch.'); }
    const [oldRows] = await conn.execute<RowDataPacket[]>('SELECT deal_id AS dealId, deal_status AS dealStatus FROM closed_deal WHERE pitch_id = ? FOR UPDATE', [pitchId]);
    await conn.execute(
      `UPDATE offer
       SET offer_status = CASE
         WHEN offer_id = ? THEN 'ACCEPTED'
         WHEN offer_status = 'ACCEPTED' THEN 'PROPOSED'
         ELSE offer_status
       END
       WHERE pitch_id = ?`,
      [offerId, pitchId],
    );
    if (oldRows.length) {
      await conn.execute(`UPDATE closed_deal SET accepted_offer_id = ?, final_agreed_amount = ?, final_agreed_equity_pct = ?, contingency_terms = ?, handshake_time = ?, deal_status = ? WHERE deal_id = ?`, [offerId, amount, equity, terms, handshakeTime, status, oldRows[0].dealId]);
    } else {
      await conn.execute(`INSERT INTO closed_deal (pitch_id, accepted_offer_id, final_agreed_amount, final_agreed_equity_pct, contingency_terms, handshake_time, deal_status) VALUES (?, ?, ?, ?, ?, ?, ?)`, [pitchId, offerId, amount, equity, terms, handshakeTime, status]);
    }
    if (!oldRows.length || oldRows[0].dealStatus !== status) {
      await conn.execute(`INSERT INTO deal_status_history (deal_id, changed_by_user_id, old_status, new_status, change_note) SELECT deal_id, ?, ?, ?, ? FROM closed_deal WHERE pitch_id = ?`, [actorUserId, oldRows[0]?.dealStatus ?? null, status, optionalText(b, 'changeNote', 1000) ?? 'Historical deal outcome updated by administrator.', pitchId]);
    }
    await conn.commit();
    return { pitchId, offerId, dealStatus: status };
  } catch (error) { await conn.rollback().catch(() => undefined); mapDbError(error); }
  finally { conn.release(); }
}

export async function deleteHistoricalDeal(pitchIdValue: unknown) {
  const pitchId = positiveId(pitchIdValue, 'pitchId');
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<RowDataPacket[]>(`SELECT d.deal_id AS dealId, p.pitch_type AS pitchType FROM closed_deal d JOIN pitch p ON p.pitch_id = d.pitch_id WHERE d.pitch_id = ? FOR UPDATE`, [pitchId]);
    if (!rows.length) { await conn.rollback(); fail(404, 'DEAL_NOT_FOUND', 'Deal outcome not found.'); }
    if (rows[0].pitchType !== 'SHOW') { await conn.rollback(); fail(409, 'NOT_HISTORICAL_DEAL', 'Only historical SHOW deal outcomes can be deleted here.'); }
    const dealId = Number(rows[0].dealId);
    await conn.execute('DELETE FROM deal_status_history WHERE deal_id = ?', [dealId]);
    await conn.execute('DELETE FROM due_diligence WHERE deal_id = ?', [dealId]);
    await conn.execute('DELETE FROM closed_deal WHERE deal_id = ?', [dealId]);
    await conn.commit();
    return { deleted: true, pitchId };
  } catch (error) { await conn.rollback().catch(() => undefined); mapDbError(error); }
  finally { conn.release(); }
}

export async function listHistoricalImportReports(limitValue: unknown = 20, offsetValue: unknown = 0) {
  const requestedLimit = limitValue === undefined ? 20 : Number(limitValue);
  const requestedOffset = offsetValue === undefined ? 0 : Number(offsetValue);
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) fail(400, 'INVALID_PAGINATION', 'limit must be a positive integer.');
  if (!Number.isSafeInteger(requestedOffset) || requestedOffset < 0) fail(400, 'INVALID_PAGINATION', 'offset must be a non-negative integer.');
  const limit = Math.min(100, requestedLimit);
  const offset = requestedOffset;
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT audit_id AS importId, changed_at AS importedAt,
            JSON_UNQUOTE(JSON_EXTRACT(new_data, '$.actorUserId')) AS actorUserId,
            JSON_UNQUOTE(JSON_EXTRACT(new_data, '$.totalRows')) AS totalRows,
            JSON_UNQUOTE(JSON_EXTRACT(new_data, '$.importedRows')) AS importedRows,
            JSON_UNQUOTE(JSON_EXTRACT(new_data, '$.failedRows')) AS failedRows
     FROM application_audit_log
     WHERE table_name = 'historical_csv_import' AND operation_type = 'IMPORT'
     ORDER BY audit_id DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows.map(row => ({
    ...row,
    importId: Number(row.importId),
    actorUserId: row.actorUserId == null ? null : Number(row.actorUserId),
    totalRows: Number(row.totalRows ?? 0),
    importedRows: Number(row.importedRows ?? 0),
    failedRows: Number(row.failedRows ?? 0),
  }));
}

export async function getHistoricalImportReport(importIdValue: unknown) {
  const importId = positiveId(importIdValue, 'importId');
  const [rows] = await dbPool.execute<RowDataPacket[]>(
    `SELECT audit_id AS importId, changed_at AS importedAt, new_data AS report
     FROM application_audit_log
     WHERE audit_id = ? AND table_name = 'historical_csv_import' AND operation_type = 'IMPORT'`,
    [importId],
  );
  if (!rows.length) fail(404, 'IMPORT_REPORT_NOT_FOUND', 'Historical import report not found.');
  let report = rows[0].report as unknown;
  if (typeof report === 'string') {
    try { report = JSON.parse(report); }
    catch { fail(500, 'INVALID_IMPORT_REPORT', 'Stored import report could not be decoded.'); }
  }
  return { importId: Number(rows[0].importId), importedAt: rows[0].importedAt, report };
}

export async function importHistoricalPitchesCsv(csvValue: unknown, actorUserId: number) {
  if (typeof csvValue !== 'string' || !csvValue.trim()) fail(400, 'INVALID_CSV', 'Provide a non-empty CSV string in the csv field.');
  if (csvValue.length > 80000) fail(413, 'CSV_TOO_LARGE', 'CSV is limited to 80,000 characters per import.');
  let rows: string[][];
  try { rows = parseHistoricalCsv(csvValue); }
  catch (error) { fail(400, 'INVALID_CSV', (error as Error).message); }
  if (rows.length < 2) fail(400, 'INVALID_CSV', 'CSV must include a header row and at least one data row.');
  if (rows.length > 501) fail(413, 'CSV_TOO_MANY_ROWS', 'Import is limited to 500 data rows.');
  const headers = rows[0].map(value => value.trim());
  if (new Set(headers).size !== headers.length) fail(400, 'INVALID_CSV', 'CSV contains duplicate header names.');
  const required = ['season_number', 'episode_number', 'pitch_sequence_order', 'brand_name', 'industry_name'];
  const allowed = new Set([
    ...required, 'country_franchise', 'episode_title', 'air_date', 'legal_business_name',
    'stage_name', 'business_model', 'website_url', 'headquarters_city', 'headquarters_state',
    'headquarters_country', 'pitch_hook', 'original_ask_amount', 'original_ask_equity_pct',
  ]);
  const missing = required.filter(name => !headers.includes(name));
  if (missing.length) fail(400, 'INVALID_CSV_HEADERS', `Missing required CSV columns: ${missing.join(', ')}.`);
  const unknownHeaders = headers.filter(name => !allowed.has(name));
  if (unknownHeaders.length) fail(400, 'INVALID_CSV_HEADERS', `Unsupported CSV columns: ${unknownHeaders.join(', ')}.`);
  const results: Array<{ row: number; status: 'IMPORTED' | 'FAILED'; pitchId?: number; brandName?: string; reason?: string }> = [];
  for (let index = 1; index < rows.length; index += 1) {
    const cells = rows[index];
    const item: Record<string, string> = {};
    headers.forEach((header, i) => { item[header] = (cells[i] ?? '').trim(); });
    const brandName = item.brand_name.slice(0, 151);
    try {
      if (cells.length !== headers.length) fail(400, 'INVALID_ROW', `Expected ${headers.length} columns but received ${cells.length}.`);
      if (!brandName.trim()) fail(400, 'INVALID_ROW', 'brand_name is required.');
      if (brandName.length > 150) fail(400, 'INVALID_ROW', 'brand_name must be at most 150 characters.');
      const legalBusinessName = item.legal_business_name ?? '';
      const pitchHook = item.pitch_hook ?? '';
      const episodeTitleInput = item.episode_title ?? '';
      const industryName = item.industry_name ?? '';
      if (legalBusinessName.length > 200) fail(400, 'INVALID_ROW', 'legal_business_name must be at most 200 characters.');
      if (industryName.length > 100) fail(400, 'INVALID_ROW', 'industry_name must be at most 100 characters.');
      if (pitchHook.length > 10000) fail(400, 'INVALID_ROW', 'pitch_hook must be at most 10,000 characters.');
      if (episodeTitleInput.length > 200) fail(400, 'INVALID_ROW', 'episode_title must be at most 200 characters.');
      const askAmount = !item.original_ask_amount?.trim() ? null : Number(item.original_ask_amount);
      const askEquity = !item.original_ask_equity_pct?.trim() ? null : Number(item.original_ask_equity_pct);
      if (askAmount !== null && (!Number.isFinite(askAmount) || askAmount < 0)) fail(400, 'INVALID_ROW', 'original_ask_amount must be non-negative.');
      if (askEquity !== null && (!Number.isFinite(askEquity) || askEquity < 0 || askEquity > 100)) fail(400, 'INVALID_ROW', 'original_ask_equity_pct must be between 0 and 100.');
      const seasonNumber = Number(item.season_number);
      const episodeNumber = Number(item.episode_number);
      const sequence = Number(item.pitch_sequence_order);
      if (![seasonNumber, episodeNumber, sequence].every(n => Number.isSafeInteger(n) && n > 0)) fail(400, 'INVALID_ROW', 'season_number, episode_number and pitch_sequence_order must be positive integers.');
      const [industries] = await dbPool.execute<RowDataPacket[]>('SELECT industry_id AS industryId FROM industry WHERE LOWER(industry_name) = LOWER(?)', [industryName]);
      if (!industries.length) fail(400, 'UNKNOWN_INDUSTRY', `industry_name "${item.industry_name}" does not match an existing reference value; no industry was invented.`);
      let stageId: number | null = null;
      if (item.stage_name) {
        const [stages] = await dbPool.execute<RowDataPacket[]>('SELECT stage_id AS stageId FROM startup_stage WHERE LOWER(stage_name) = LOWER(?)', [item.stage_name]);
        if (!stages.length) fail(400, 'UNKNOWN_STAGE', `stage_name "${item.stage_name}" does not match an existing reference value.`);
        stageId = Number(stages[0].stageId);
      }
      const franchise = item.country_franchise || 'India';
      const conn = await dbPool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.execute(
          `INSERT INTO show_season (season_number, country_franchise)
           VALUES (?, ?) ON DUPLICATE KEY UPDATE season_number = VALUES(season_number)`, [seasonNumber, franchise],
        );
        const [seasonRows] = await conn.execute<RowDataPacket[]>('SELECT season_id AS seasonId FROM show_season WHERE season_number = ? AND country_franchise = ? FOR UPDATE', [seasonNumber, franchise]);
        const seasonId = Number(seasonRows[0].seasonId);
        const episodeTitle = episodeTitleInput || null;
        const airDate = item.air_date || null;
        if (episodeTitle && episodeTitle.length > 200) fail(400, 'INVALID_ROW', 'episode_title must be at most 200 characters.');
        if (airDate) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(airDate)) fail(400, 'INVALID_ROW', 'air_date must be YYYY-MM-DD when provided.');
          const parsedAirDate = new Date(`${airDate}T00:00:00Z`);
          if (Number.isNaN(parsedAirDate.getTime()) || parsedAirDate.toISOString().slice(0, 10) !== airDate) fail(400, 'INVALID_ROW', 'air_date must be a valid calendar date.');
        }
        await conn.execute(
          `INSERT INTO show_episode (season_id, episode_number, episode_title, air_date)
           VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE episode_title = COALESCE(VALUES(episode_title), episode_title), air_date = COALESCE(VALUES(air_date), air_date)`,
          [seasonId, episodeNumber, episodeTitle, airDate],
        );
        const [episodeRows] = await conn.execute<RowDataPacket[]>('SELECT episode_id AS episodeId FROM show_episode WHERE season_id = ? AND episode_number = ? FOR UPDATE', [seasonId, episodeNumber]);
        const episodeId = Number(episodeRows[0].episodeId);
        const [existingPitch] = await conn.execute<RowDataPacket[]>(`SELECT pitch_id AS pitchId, company_id AS companyId FROM pitch WHERE pitch_type = 'SHOW' AND episode_id = ? AND pitch_sequence_order = ? FOR UPDATE`, [episodeId, sequence]);
        const companyFields = [brandName, legalBusinessName || null, Number(industries[0].industryId), stageId, item.business_model || null, item.website_url || null, item.headquarters_city || null, item.headquarters_state || null, item.headquarters_country || 'India'];
        let pitchId: number;
        if (existingPitch.length) {
          const companyId = Number(existingPitch[0].companyId);
          await conn.execute('UPDATE company SET brand_name = ?, legal_business_name = ?, industry_id = ?, stage_id = ?, business_model = ?, website_url = ?, headquarters_city = ?, headquarters_state = ?, headquarters_country = ? WHERE company_id = ?', [...companyFields, companyId]);
          await conn.execute(`UPDATE pitch SET pitch_hook = ?, original_ask_amount = ?, original_ask_equity_pct = ?, pitch_status = 'PUBLISHED' WHERE pitch_id = ?`, [pitchHook || null, askAmount, askEquity, existingPitch[0].pitchId]);
          pitchId = Number(existingPitch[0].pitchId);
        } else {
          const [company] = await conn.execute<ResultSetHeader>(`INSERT INTO company (brand_name, legal_business_name, industry_id, stage_id, business_model, website_url, headquarters_city, headquarters_state, headquarters_country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, companyFields);
          const [pitch] = await conn.execute<ResultSetHeader>(`INSERT INTO pitch (company_id, pitch_type, episode_id, submitted_by_user_id, pitch_sequence_order, original_ask_amount, original_ask_equity_pct, pitch_hook, pitch_status) VALUES (?, 'SHOW', ?, NULL, ?, ?, ?, ?, 'PUBLISHED')`, [company.insertId, episodeId, sequence, askAmount, askEquity, pitchHook || null]);
          pitchId = Number(pitch.insertId);
        }
        await conn.commit();
        results.push({ row: index + 1, status: 'IMPORTED', pitchId, brandName: brandName.slice(0, 150) });
      } catch (error) { await conn.rollback().catch(() => undefined); throw error; }
      finally { conn.release(); }
    } catch (error) {
      const err = error as { message?: string; code?: string };
      results.push({ row: index + 1, status: 'FAILED', brandName: brandName.slice(0, 150), reason: String(err.message ?? err.code ?? 'Invalid row.').slice(0, 500) });
    }
  }
  const imported = results.filter(row => row.status === 'IMPORTED').length;
  const report = {
    importedAt: new Date().toISOString(),
    actorUserId,
    totalRows: results.length,
    importedRows: imported,
    failedRows: results.length - imported,
    results,
  };
  // Persist a bounded, admin-retrievable report in the existing audit log, without
  // adding a new schema dependency or storing the source CSV itself.
  const [audit] = await dbPool.execute<ResultSetHeader>(
    `INSERT INTO application_audit_log (table_name, operation_type, record_id, old_data, new_data)
     VALUES ('historical_csv_import', 'IMPORT', NULL, NULL, ?)`,
    [JSON.stringify(report)],
  );
  return { importId: audit.insertId, ...report };
}
