/**
 * Sauda Admin Console API Service
 * Central typed service client for administrative operations:
 * - Platform pitch review queue and decision recording
 * - Operational statistics and system health
 * - Historical seasons, episodes, and sharks management
 * - CSV batch import and import report audits
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type ReviewDecision = 'PUBLISH' | 'REJECT';
export type PitchStatus = 'SUBMITTED' | 'PUBLISHED' | 'REJECTED' | 'DRAFT' | 'ARCHIVED';

export interface ReviewPitch {
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
  pitchStatus: PitchStatus;
  submittedAt: string;
  founderUserId: number;
  founderName: string;
}

export interface ReviewHistoryItem {
  reviewEventId: number;
  pitchId: number;
  decision: ReviewDecision;
  reviewNote: string | null;
  decidedAt: string;
  reviewerUserId: number;
  reviewerName: string;
}

export interface HistoricalSeason {
  seasonId: number;
  seasonNumber: number;
  countryFranchise: string;
  premiereDate: string | null;
  finaleDate: string | null;
  totalEpisodes: number | null;
  networkChannel: string | null;
  productionHouse: string | null;
  storedEpisodeCount?: number;
  storedPitchCount?: number;
}

export interface CreateSeasonPayload {
  seasonNumber: number;
  countryFranchise?: string;
  premiereDate?: string | null;
  finaleDate?: string | null;
  totalEpisodes?: number | null;
  networkChannel?: string | null;
  productionHouse?: string | null;
  budgetAmount?: number | null;
}

export interface HistoricalEpisode {
  episodeId: number;
  seasonId: number;
  episodeNumber: number;
  episodeTitle: string | null;
  tapeDate: string | null;
  airDate: string | null;
  durationMinutes: number | null;
  tvRating: number | null;
  viewersCountMillions: number | null;
  filmingLocation: string | null;
  videoUrl: string | null;
  pitchCount?: number;
  sharkCount?: number;
}

export interface CreateEpisodePayload {
  seasonId: number;
  episodeNumber: number;
  episodeTitle?: string | null;
  tapeDate?: string | null;
  airDate?: string | null;
  durationMinutes?: number | null;
  tvRating?: number | null;
  viewersCountMillions?: number | null;
  filmingLocation?: string | null;
  videoUrl?: string | null;
}

export interface HistoricalShark {
  sharkId: number;
  stageName: string | null;
  gender: string | null;
  birthDate: string | null;
  isGuestShark: boolean | number;
  displayName: string;
  investmentFirmName: string | null;
  episodeCount?: number;
}

export interface CreateSharkPayload {
  displayName: string;
  investmentFirmName?: string | null;
  stageName?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  isGuestShark?: boolean;
}

export interface HistoricalStatistics {
  dealsBySeason: Array<{
    seasonId: number;
    seasonNumber: number;
    countryFranchise: string;
    pitchCount: number;
    completedDeals: number;
    fellThroughDeals: number;
    pendingDeals: number;
    noRecordedOutcome: number;
  }>;
  sectorDistribution: Array<{
    industryId: number;
    industryName: string;
    pitchCount: number;
    completedDeals: number;
    fellThroughDeals: number;
    noRecordedOutcome: number;
  }>;
  sharkActivity: Array<{
    sharkId: number;
    displayName: string;
    episodesAppeared: number;
    pitchesSeen: number;
    completedDealsAssociated: number;
  }>;
}

export interface ImportReportSummary {
  importId: number;
  importedAt: string;
  actorUserId: number | null;
  totalRows: number;
  importedRows: number;
  failedRows: number;
}

export interface ImportReportRow {
  row: number;
  status: 'IMPORTED' | 'FAILED';
  pitchId?: number;
  brandName?: string;
  reason?: string;
}

export interface ImportReportDetail {
  importId: number;
  importedAt: string;
  report: {
    totalRows: number;
    importedRows: number;
    failedRows: number;
    rows?: ImportReportRow[];
  };
}

// Helper to parse JSON errors
async function handleResponseError(res: Response, fallback: string): Promise<never> {
  const data = await res.json().catch(() => ({}));
  const message = data.message || data.error || `${fallback} (Status ${res.status})`;
  throw new Error(message);
}

// ============================================================================
// 1. REVIEWS
// ============================================================================

export async function fetchReviewQueue(signal?: AbortSignal): Promise<ReviewPitch[]> {
  const res = await fetch(`${API_BASE_URL}/api/admin/reviews`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) await handleResponseError(res, 'Unable to load review queue');
  const payload = await res.json();
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function fetchReviewDetail(
  pitchId: number,
  signal?: AbortSignal,
): Promise<{ pitch: ReviewPitch; history: ReviewHistoryItem[] }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/reviews/${pitchId}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) await handleResponseError(res, 'Unable to load pitch review details');
  const payload = await res.json();
  return {
    pitch: payload.pitch,
    history: Array.isArray(payload.history) ? payload.history : [],
  };
}

export async function submitReviewDecision(
  pitchId: number,
  decision: ReviewDecision,
  note: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/reviews/${pitchId}/decision`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ decision, note }),
  });
  if (!res.ok) await handleResponseError(res, 'Unable to save review decision');
}

// ============================================================================
// 2. OVERVIEW METRICS & HEALTH
// ============================================================================

export async function fetchDatabaseHealth(signal?: AbortSignal): Promise<{ status: string; database: 'connected' | 'disconnected' }> {
  const res = await fetch(`${API_BASE_URL}/api/health/db`, { signal });
  if (!res.ok) return { status: 'error', database: 'disconnected' };
  const data = await res.json();
  return {
    status: data.status || 'unknown',
    database: data.database === 'connected' ? 'connected' : 'disconnected',
  };
}

export async function fetchHistoricalStatistics(signal?: AbortSignal): Promise<HistoricalStatistics> {
  const res = await fetch(`${API_BASE_URL}/api/statistics/historical`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) await handleResponseError(res, 'Failed to calculate historical statistics');
  const data = await res.json();
  return {
    dealsBySeason: Array.isArray(data.dealsBySeason) ? data.dealsBySeason : [],
    sectorDistribution: Array.isArray(data.sectorDistribution) ? data.sectorDistribution : [],
    sharkActivity: Array.isArray(data.sharkActivity) ? data.sharkActivity : [],
  };
}

// ============================================================================
// 3. HISTORICAL SEASONS CRUD
// ============================================================================

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
  if (!res.ok) await handleResponseError(res, 'Failed to load historical seasons');
  const data = await res.json();
  return Array.isArray(data.data) ? data.data : [];
}

export async function createHistoricalSeason(payload: CreateSeasonPayload): Promise<{ ok: boolean; seasonId: number }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/historical/seasons`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) await handleResponseError(res, 'Failed to create season');
  return await res.json();
}

export async function updateHistoricalSeason(
  seasonId: number,
  payload: Partial<CreateSeasonPayload>,
): Promise<{ ok: boolean; seasonId: number }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/historical/seasons/${seasonId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) await handleResponseError(res, 'Failed to update season');
  return await res.json();
}

export async function deleteHistoricalSeason(seasonId: number): Promise<{ ok: boolean; deleted: boolean; seasonId: number }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/historical/seasons/${seasonId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) await handleResponseError(res, 'Failed to delete season');
  return await res.json();
}

// ============================================================================
// 4. HISTORICAL EPISODES CRUD
// ============================================================================

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
  if (!res.ok) await handleResponseError(res, 'Failed to load historical episodes');
  const data = await res.json();
  return Array.isArray(data.data) ? data.data : [];
}

export async function createHistoricalEpisode(payload: CreateEpisodePayload): Promise<{ ok: boolean; episodeId: number }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/historical/episodes`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) await handleResponseError(res, 'Failed to create episode');
  return await res.json();
}

export async function updateHistoricalEpisode(
  episodeId: number,
  payload: Partial<CreateEpisodePayload>,
): Promise<{ ok: boolean; episodeId: number }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/historical/episodes/${episodeId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) await handleResponseError(res, 'Failed to update episode');
  return await res.json();
}

export async function deleteHistoricalEpisode(episodeId: number): Promise<{ ok: boolean; deleted: boolean; episodeId: number }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/historical/episodes/${episodeId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) await handleResponseError(res, 'Failed to delete episode');
  return await res.json();
}

// ============================================================================
// 5. HISTORICAL SHARKS CRUD
// ============================================================================

export async function fetchHistoricalSharks(signal?: AbortSignal): Promise<HistoricalShark[]> {
  const res = await fetch(`${API_BASE_URL}/api/historical/sharks`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) await handleResponseError(res, 'Failed to load historical Sharks');
  const data = await res.json();
  return Array.isArray(data.data) ? data.data : [];
}

export async function createHistoricalShark(payload: CreateSharkPayload): Promise<{ ok: boolean; sharkId: number }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/historical/sharks`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) await handleResponseError(res, 'Failed to create Shark');
  return await res.json();
}

export async function updateHistoricalShark(
  sharkId: number,
  payload: Partial<CreateSharkPayload>,
): Promise<{ ok: boolean; sharkId: number }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/historical/sharks/${sharkId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) await handleResponseError(res, 'Failed to update Shark');
  return await res.json();
}

export async function deleteHistoricalShark(sharkId: number): Promise<{ ok: boolean; deleted: boolean; sharkId: number }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/historical/sharks/${sharkId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) await handleResponseError(res, 'Failed to delete Shark');
  return await res.json();
}

// ============================================================================
// 6. CSV BATCH IMPORT & REPORTS
// ============================================================================

export async function importPitchesCsv(csvContent: string): Promise<{ ok: boolean; report: ImportReportDetail['report'] }> {
  const res = await fetch(`${API_BASE_URL}/api/admin/historical/import/pitches`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ csv: csvContent }),
  });
  if (!res.ok) await handleResponseError(res, 'Failed to import CSV');
  return await res.json();
}

export async function fetchImportReports(
  limit = 20,
  offset = 0,
  signal?: AbortSignal,
): Promise<ImportReportSummary[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await fetch(`${API_BASE_URL}/api/admin/historical/imports?${params.toString()}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) await handleResponseError(res, 'Failed to load historical import reports');
  const data = await res.json();
  return Array.isArray(data.imports) ? data.imports : [];
}

export async function fetchImportReportDetail(
  importId: number,
  signal?: AbortSignal,
): Promise<ImportReportDetail> {
  const res = await fetch(`${API_BASE_URL}/api/admin/historical/imports/${importId}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) await handleResponseError(res, 'Failed to load import report detail');
  return await res.json();
}
