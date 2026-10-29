import type {
  ComparisonResponse,
  HistoricalEpisode,
  HistoricalEpisodeDetail,
  HistoricalPitchFilters,
  HistoricalPitchRow,
  HistoricalSeason,
  HistoricalShark,
  HistoricalStatistics,
} from '../types/historical.ts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function handleResponseError(res: Response, fallbackMessage: string): Promise<never> {
  let message = fallbackMessage;
  try {
    const data = await res.json();
    if (data && typeof data === 'object') {
      if (typeof data.message === 'string') message = data.message;
      else if (typeof data.error === 'string') message = data.error;
    }
  } catch {
    // Non-JSON response body
  }
  throw new Error(message);
}

/**
 * Fetch historical seasons from GET /api/historical/seasons
 */
export async function fetchHistoricalSeasons(
  limit = 100,
  offset = 0,
  franchise?: string,
  signal?: AbortSignal,
): Promise<HistoricalSeason[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (franchise) params.set('franchise', franchise);

  const res = await fetch(`${API_BASE_URL}/api/historical/seasons?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) await handleResponseError(res, 'Failed to load historical seasons.');
  const data = await res.json();
  return Array.isArray(data.data) ? data.data : [];
}

/**
 * Fetch episodes for a season from GET /api/historical/seasons/:seasonId/episodes
 */
export async function fetchHistoricalEpisodes(
  seasonId: number,
  limit = 100,
  offset = 0,
  signal?: AbortSignal,
): Promise<HistoricalEpisode[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await fetch(`${API_BASE_URL}/api/historical/seasons/${seasonId}/episodes?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) await handleResponseError(res, 'Failed to load historical episodes.');
  const data = await res.json();
  return Array.isArray(data.data) ? data.data : [];
}

/**
 * Fetch full episode detail from GET /api/historical/episodes/:episodeId
 */
export async function fetchHistoricalEpisodeDetail(
  episodeId: number,
  signal?: AbortSignal,
): Promise<HistoricalEpisodeDetail> {
  const res = await fetch(`${API_BASE_URL}/api/historical/episodes/${episodeId}`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) await handleResponseError(res, 'Failed to load historical episode details.');
  const data = await res.json();
  return {
    episode: data.episode,
    pitches: Array.isArray(data.pitches) ? data.pitches : [],
    sharks: Array.isArray(data.sharks) ? data.sharks : [],
    offers: Array.isArray(data.offers) ? data.offers : [],
  };
}

/**
 * Search/filter historical pitches from GET /api/historical/pitches
 */
export async function searchHistoricalPitches(
  filters: HistoricalPitchFilters = {},
  signal?: AbortSignal,
): Promise<HistoricalPitchRow[]> {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.seasonId) params.set('seasonId', String(filters.seasonId));
  if (filters.industryId) params.set('industryId', String(filters.industryId));
  if (filters.sharkId) params.set('sharkId', String(filters.sharkId));
  if (filters.dealStatus) params.set('dealStatus', filters.dealStatus);
  params.set('limit', String(filters.limit ?? 50));
  params.set('offset', String(filters.offset ?? 0));

  const res = await fetch(`${API_BASE_URL}/api/historical/pitches?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) await handleResponseError(res, 'Failed to search historical pitches.');
  const data = await res.json();
  return Array.isArray(data.data) ? data.data : [];
}

export const fetchHistoricalPitches = searchHistoricalPitches;

/**
 * List all historical sharks from GET /api/historical/sharks
 */
export async function fetchHistoricalSharks(signal?: AbortSignal): Promise<HistoricalShark[]> {
  const res = await fetch(`${API_BASE_URL}/api/historical/sharks`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) await handleResponseError(res, 'Failed to load historical Sharks.');
  const data = await res.json();
  return Array.isArray(data.data) ? data.data : [];
}

/**
 * Fetch verified broadcast statistics from GET /api/statistics/historical
 */
export async function fetchHistoricalStatistics(signal?: AbortSignal): Promise<HistoricalStatistics> {
  const res = await fetch(`${API_BASE_URL}/api/statistics/historical`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) await handleResponseError(res, 'Failed to load historical statistics.');
  const data = await res.json();
  return {
    dealsBySeason: Array.isArray(data.dealsBySeason) ? data.dealsBySeason : [],
    sectorDistribution: Array.isArray(data.sectorDistribution) ? data.sectorDistribution : [],
    sharkActivity: Array.isArray(data.sharkActivity) ? data.sharkActivity : [],
  };
}

/**
 * Authoritative backend comparison for 2 or 3 startups: POST /api/startups/compare
 */
export async function compareStartupsApi(
  companyIds: number[],
  signal?: AbortSignal,
): Promise<ComparisonResponse> {
  const res = await fetch(`${API_BASE_URL}/api/startups/compare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ companyIds }),
    signal,
  });

  if (!res.ok) await handleResponseError(res, 'Failed to compare startups.');
  const data = await res.json();
  return {
    ok: true,
    sourceType: data.sourceType,
    items: Array.isArray(data.items) ? data.items : [],
  };
}

/**
 * Converts a database historical pitch row into a Startup domain model object
 */
export function historicalPitchRowToStartup(row: HistoricalPitchRow) {
  return {
    pitchId: row.pitchId,
    pitchType: 'SHOW' as const,
    originalAskAmount: row.originalAskAmount,
    originalAskEquityPct: row.originalAskEquityPct,
    pitchHook: row.pitchHook,
    submittedAt: '',
    companyId: row.companyId,
    brandName: row.brandName,
    legalBusinessName: row.legalBusinessName,
    businessModel: row.businessModel,
    websiteUrl: row.websiteUrl,
    foundedYear: row.foundedYear,
    headquartersCity: row.headquartersCity,
    headquartersState: row.headquartersState,
    headquartersCountry: row.headquartersCountry,
    industry: row.industry,
    startupStage: null,
  };
}
