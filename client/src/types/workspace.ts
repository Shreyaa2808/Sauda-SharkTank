export type AppWorkspace = 'viewer' | 'founder' | 'investor';

export interface IndustryOption {
  industryId: number;
  industryName: string;
  description: string | null;
}

export interface StageOption {
  stageId: number;
  stageName: string;
}

export interface MetadataCategories {
  industries: IndustryOption[];
  stages: StageOption[];
}

export interface FounderPitch {
  pitchId: number;
  companyId: number;
  pitchType: 'SHOW' | 'PLATFORM';
  pitchStatus: 'DRAFT' | 'SUBMITTED' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
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

export interface InvestorPitchesFilter {
  search?: string;
  industry?: string;
  stage?: string;
  source?: 'ALL' | 'SHOW' | 'PLATFORM';
  sortBy?: 'latest' | 'ask_asc' | 'ask_desc' | 'brand_name';
  savedOnly?: boolean;
}

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
  endedAt: string | null;
  conversationId: number | null;
  conversationStatus: 'OPEN' | 'READ_ONLY' | null;
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
