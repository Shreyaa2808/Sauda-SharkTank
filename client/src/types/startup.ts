export type PitchType = 'SHOW' | 'PLATFORM';

export interface Startup {
  pitchId: number;
  pitchType: PitchType;
  originalAskAmount: string | number | null;
  originalAskEquityPct: string | number | null;
  pitchHook: string | null;
  submittedAt: string;
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
}

export interface StartupResponse {
  count: number;
  data: Startup[];
}

export type MakoState = 'idle' | 'discovering' | 'empty' | 'offline' | 'success';
