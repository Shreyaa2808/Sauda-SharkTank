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

export interface HistoricalEpisodePitch {
  pitchId: number;
  companyId: number;
  pitchSequenceOrder: number;
  pitchHook: string | null;
  originalAskAmount: number | string | null;
  originalAskEquityPct: number | string | null;
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
  dealStatus: 'PENDING_DUE_DILIGENCE' | 'COMPLETED' | 'FELL_THROUGH' | null;
  finalAgreedAmount: number | string | null;
  finalAgreedEquityPct: number | string | null;
}

export interface HistoricalEpisodeShark {
  sharkId: number;
  stageName: string | null;
  gender: string | null;
  isGuestShark: boolean | number;
  displayName: string;
  investmentFirmName: string | null;
  chairPositionNumber: number;
}

export interface HistoricalEpisodeOffer {
  offerId: number;
  pitchId: number;
  roundNumber: number;
  isCounterOffer: boolean | number;
  amountOffered: number | string | null;
  equityRequestedPct: number | string | null;
  royaltyPerUnit: number | string | null;
  royaltyCapAmount: number | string | null;
  loanAmount: number | string | null;
  loanInterestRatePct: number | string | null;
  advisorySharesPct: number | string | null;
  offerStatus: string;
  createdByInvestorName: string | null;
}

export interface HistoricalEpisodeDetail {
  episode: HistoricalEpisode & {
    seasonNumber: number;
    countryFranchise: string;
  };
  pitches: HistoricalEpisodePitch[];
  sharks: HistoricalEpisodeShark[];
  offers: HistoricalEpisodeOffer[];
}

export interface HistoricalPitchRow {
  pitchId: number;
  companyId: number;
  pitchSequenceOrder: number;
  pitchHook: string | null;
  originalAskAmount: number | string | null;
  originalAskEquityPct: number | string | null;
  brandName: string;
  legalBusinessName: string | null;
  businessModel: string | null;
  websiteUrl: string | null;
  foundedYear: number | null;
  headquartersCity: string | null;
  headquartersState: string | null;
  headquartersCountry: string | null;
  industry: string | null;
  seasonId: number;
  seasonNumber: number;
  countryFranchise: string;
  episodeId: number;
  episodeNumber: number;
  episodeTitle: string | null;
  dealStatus: 'PENDING_DUE_DILIGENCE' | 'COMPLETED' | 'FELL_THROUGH' | null;
  finalAgreedAmount: number | string | null;
  finalAgreedEquityPct: number | string | null;
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

export interface ComparisonItem {
  companyId: number;
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
  sourceTypes: string;
  hasPublishedPlatformPitch: number;
  pitchId: number;
  originalAskAmount: number | string | null;
  originalAskEquityPct: number | string | null;
  pitchHook: string | null;
}

export interface ComparisonResponse {
  ok: boolean;
  sourceType: 'SHOW' | 'PLATFORM';
  items: ComparisonItem[];
}

export interface HistoricalPitchFilters {
  search?: string;
  seasonId?: number;
  industryId?: number;
  sharkId?: number;
  dealStatus?: 'PENDING_DUE_DILIGENCE' | 'COMPLETED' | 'FELL_THROUGH' | 'UNKNOWN';
  limit?: number;
  offset?: number;
}
