/**
 * SAUDA FOUNDER BATTLE ARENA — Core Types
 * Cinematic Investor Matching, Financial Analysis & Startup Investment Readiness
 */

export type StartupStage =
  | 'IDEA'
  | 'PROTOTYPE'
  | 'MVP'
  | 'EARLY_REVENUE'
  | 'GROWTH'
  | 'SCALING';

export type SectorType =
  | 'FinTech'
  | 'HealthTech'
  | 'EdTech'
  | 'AI & DeepTech'
  | 'SaaS'
  | 'Consumer Products'
  | 'ClimateTech'
  | 'E-commerce'
  | 'Manufacturing'
  | 'AgriTech'
  | 'Other';

export type BusinessModelType =
  | 'B2B'
  | 'B2C'
  | 'B2B2C'
  | 'D2C'
  | 'Marketplace'
  | 'Enterprise SaaS'
  | 'Hardware'
  | 'Hybrid';

export type FundingInstrument =
  | 'Equity'
  | 'Debt'
  | 'Convertible Note'
  | 'SAFE'
  | 'Strategic Investment'
  | 'Royalty / Revenue Share';

export type StrategicCapability =
  | 'Capital Injection'
  | 'Mentorship & Advisory'
  | 'Industry Expertise'
  | 'Retail & Offline Distribution'
  | 'E-commerce & Digital Marketing'
  | 'Technical & AI Architecture'
  | 'Strategic Partnerships'
  | 'Enterprise Sales & B2B Leads'
  | 'International Expansion'
  | 'Brand Credibility & Media Access';

export interface InvestorProfile {
  id: string;
  name: string;
  code: string; // e.g., 'COMPANY_A', 'COMPANY_B'
  firmName: string;
  category: 'VENTURE_CAPITAL' | 'ANGEL_INVESTOR' | 'CORPORATE_VC' | 'SHARK_PANEL';
  logoText: string;
  avatarBg: string;
  accentColor: string;
  glowColor: string;
  tagline: string;
  description: string;
  investmentThesis: string;
  preferredSectors: SectorType[];
  preferredStages: StartupStage[];
  minInvestment: number; // in INR (₹)
  maxInvestment: number; // in INR (₹)
  typicalCheckSize: number;
  fundingTypes: FundingInstrument[];
  geographicFocus: string[]; // e.g. ['India', 'Southeast Asia', 'Global']
  businessModels: BusinessModelType[];
  strategicCapabilities: StrategicCapability[];
  notablePortfolio: string[];
  hardExclusions: {
    sectors?: string[];
    stages?: string[];
    minRevenue?: number;
    requireProduct?: boolean;
    excludedFundingTypes?: string[];
  };
  verified: boolean;
  source: string;
  stats: {
    portfolioCount: number;
    dealsLastYear: number;
    followOnRatePct: number;
    leadInvestorRatePct: number;
  };
}

export interface FounderStartupProfile {
  name: string;
  tagline: string;
  sector: SectorType;
  subsector: string;
  stage: StartupStage;
  businessModel: BusinessModelType;
  locationCity: string;
  locationCountry: string;
  website: string;
  description: string;
  problem: string;
  solution: string;
  competitiveAdvantage: string;
  targetMarket: string;
  
  // Financials
  mrr: number | null; // Monthly recurring revenue (₹)
  arr: number | null; // Annual recurring revenue (₹)
  revenueGrowthMoM: number | null; // % growth month-over-month
  previousQuarterRevenue: number | null; // ₹ for YoY / QoQ calculation
  currentQuarterRevenue: number | null;
  grossMarginPct: number | null; // % (0-100)
  monthlyBurn: number | null; // ₹
  cashRunwayMonths: number | null;
  availableCash: number | null;
  activeCustomers: number | null;
  cac: number | null; // Customer acquisition cost (₹)
  ltv: number | null; // Lifetime value (₹)
  priorFundingRaised: number | null;
  
  // Metrics Availability status
  isPreRevenue: boolean;
  hasCacLtvCalculated: boolean;
}

export interface InvestmentBlueprint {
  fundingAsk: number; // in INR (₹)
  equityOfferedPct: number; // e.g. 5.0 for 5%
  minAcceptableInvestment: number;
  preferredInstrument: FundingInstrument;
  primaryObjective: string;
  strategicPriorities: StrategicCapability[];
  fundAllocation: {
    productDevelopment: number; // percentage (0-100)
    marketing: number;
    hiring: number;
    operations: number;
    researchAndPatents: number;
    expansion: number;
    other: number;
  };
}

export interface CriterionScore {
  name: string;
  key: string;
  weightPct: number; // e.g., 25 for 25%
  score: number; // 0 - 100
  evidence: string;
  supported: boolean; // whether data was available
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
  detail: string;
}

export interface InvestorEvaluation {
  investorId: string;
  investor: InvestorProfile;
  compatibilityScore: number; // 0 - 100 normalized
  rawWeightedSum: number;
  dataCoveragePct: number; // 0 - 100
  confidence: 'HIGH' | 'MODERATE' | 'LOW';
  criteriaScores: CriterionScore[];
  strongestMatches: string[];
  keyMismatches: string[];
  missingInformation: string[];
  hardConstraintViolation: string | null;
  fundingFitStatus: 'WITHIN_RANGE' | 'NEAR_LOWER_BOUND' | 'NEAR_UPPER_BOUND' | 'BELOW_RANGE' | 'EXCEEDS_RANGE' | 'UNKNOWN';
  impliedValuationPreMoney: number | null;
  impliedValuationPostMoney: number | null;
}

export interface FinancialCalculations {
  impliedPostMoneyValuation: number | null;
  impliedPreMoneyValuation: number | null;
  annualizedRunRate: number | null;
  ltvToCacRatio: number | null;
  estimatedMonthsRunway: number | null;
  grossMargin: number | null;
  revenueGrowthPct: number | null;
  burnMultiple: number | null;
  capitalEfficiencyScore: number;
}

export interface ReadinessCategory {
  category: string;
  score: number; // 0 - 100
  status: 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK' | 'INSUFFICIENT_DATA';
  explanation: string;
  strengths: string[];
  missingPoints: string[];
  recommendation: string;
}

export interface StartupReadinessAssessment {
  overallReadinessScore: number; // 0 - 100
  categories: ReadinessCategory[];
  summaryNote: string;
}

export type BattleOutcomeType =
  | 'DECISIVE_WINNER'
  | 'NEAR_TIE'
  | 'NEITHER_SUITABLE'
  | 'INCONCLUSIVE';

export interface ImprovementAction {
  id: string;
  gapTitle: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  currentSituation: string;
  targetSituation: string;
  relevantInvestorCriterion: string;
  recommendedAction: string;
  potentialScoreLiftPct: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface BattleAnalysisResult {
  battleId: string;
  timestamp: string;
  startup: FounderStartupProfile;
  requirements: InvestmentBlueprint;
  investorA: InvestorEvaluation;
  investorB: InvestorEvaluation;
  financialCalculations: FinancialCalculations;
  readiness: StartupReadinessAssessment;
  outcomeType: BattleOutcomeType;
  winnerInvestorId: string | null;
  scoreDelta: number;
  verdictHeadline: string;
  verdictExplanation: string;
  tradeoffAnalysis: string;
  improvementPlan: ImprovementAction[];
  scoringWeightsVersion: string;
}
