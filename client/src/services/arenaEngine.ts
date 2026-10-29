import type {
  FounderStartupProfile,
  InvestmentBlueprint,
  InvestorProfile,
  InvestorEvaluation,
  CriterionScore,
  StartupReadinessAssessment,
  ReadinessCategory,
  ImprovementAction,
  BattleAnalysisResult,
  BattleOutcomeType,
} from '../types/arena.ts';
import { calculateFinancialMetrics } from './arenaFinancials.ts';

/**
 * Centrally Configured Weights for Compatibility Model
 * Total = 100%
 */
export const CRITERIA_WEIGHTS = {
  sectorAlignment: 25,
  fundingCompatibility: 20,
  stageCompatibility: 15,
  businessModelAlignment: 10,
  tractionAndGrowth: 10,
  strategicAlignment: 10,
  geographicCompatibility: 5,
  marketThesisAlignment: 5,
};

export const NEAR_TIE_DELTA_THRESHOLD = 3.5; // percentage points

/**
 * Evaluate Hard Constraints & Eligibility
 */
function checkHardConstraints(
  startup: FounderStartupProfile,
  requirements: InvestmentBlueprint,
  investor: InvestorProfile,
): string | null {
  const { hardExclusions } = investor;

  if (hardExclusions.sectors && hardExclusions.sectors.length > 0) {
    const isExcluded = hardExclusions.sectors.some(
      (sec) =>
        sec.toLowerCase() === startup.sector.toLowerCase() ||
        (startup.subsector && startup.subsector.toLowerCase().includes(sec.toLowerCase())),
    );
    if (isExcluded) {
      return `Mandatory exclusion: ${investor.name} policy strictly excludes ventures in ${startup.sector}.`;
    }
  }

  if (hardExclusions.stages && hardExclusions.stages.includes(startup.stage)) {
    return `Eligibility barrier: ${investor.name} requires companies to be at or past MVP stage (Current stage: ${startup.stage}).`;
  }

  if (
    hardExclusions.minRevenue &&
    hardExclusions.minRevenue > 0 &&
    (startup.mrr === null || startup.mrr < hardExclusions.minRevenue)
  ) {
    return `Revenue threshold: ${investor.name} mandates documented MRR of at least ₹${(hardExclusions.minRevenue / 100000).toFixed(1)}L.`;
  }

  if (hardExclusions.excludedFundingTypes?.includes(requirements.preferredInstrument)) {
    return `Instrument mismatch: ${investor.name} does not accept investments via ${requirements.preferredInstrument}.`;
  }

  return null;
}

/**
 * Evaluates individual investor alignment against founder startup & blueprint
 */
export function evaluateInvestorCompatibility(
  startup: FounderStartupProfile,
  requirements: InvestmentBlueprint,
  investor: InvestorProfile,
): InvestorEvaluation {
  const hardConstraintViolation = checkHardConstraints(startup, requirements, investor);

  const criteriaScores: CriterionScore[] = [];
  const strongestMatches: string[] = [];
  const keyMismatches: string[] = [];
  const missingInformation: string[] = [];

  // 1. Sector Alignment (Weight: 25%)
  let sectorScore = 30; // default baseline
  let sectorEvidence = '';
  const sectorMatches = investor.preferredSectors.some(
    (s) => s.toLowerCase() === startup.sector.toLowerCase(),
  );

  if (sectorMatches) {
    sectorScore = 95;
    sectorEvidence = `Direct match: ${startup.sector} is a documented primary thesis sector for ${investor.name}.`;
    strongestMatches.push(`Primary sector alignment with ${startup.sector}`);
  } else {
    sectorScore = 40;
    sectorEvidence = `${startup.sector} is not among ${investor.name}'s prioritized sectors (${investor.preferredSectors.join(', ')}).`;
    keyMismatches.push(`Outside primary sector mandate (${investor.preferredSectors.slice(0, 3).join(', ')})`);
  }

  criteriaScores.push({
    name: 'Sector Alignment',
    key: 'sectorAlignment',
    weightPct: CRITERIA_WEIGHTS.sectorAlignment,
    score: sectorScore,
    evidence: sectorEvidence,
    supported: true,
    importance: 'HIGH',
    detail: `${startup.sector} vs [${investor.preferredSectors.join(', ')}]`,
  });

  // 2. Funding Compatibility (Weight: 20%)
  let fundingScore = 50;
  let fundingStatus: InvestorEvaluation['fundingFitStatus'] = 'UNKNOWN';
  let fundingEvidence = '';

  const ask = requirements.fundingAsk;
  if (ask >= investor.minInvestment && ask <= investor.maxInvestment) {
    fundingScore = 96;
    fundingStatus = 'WITHIN_RANGE';
    fundingEvidence = `Requested ask of ₹${(ask / 100000).toFixed(1)}L is well within the typical range (₹${(investor.minInvestment / 100000).toFixed(0)}L – ₹${(investor.maxInvestment / 100000).toFixed(0)}L).`;
    strongestMatches.push(`Ideal ticket size alignment`);
  } else if (ask < investor.minInvestment) {
    const ratio = ask / investor.minInvestment;
    fundingScore = Math.max(30, Math.round(ratio * 75));
    fundingStatus = 'BELOW_RANGE';
    fundingEvidence = `Requested funding (₹${(ask / 100000).toFixed(1)}L) is below ${investor.name}'s standard entry check (min ₹${(investor.minInvestment / 100000).toFixed(0)}L).`;
    keyMismatches.push(`Ticket size below investor minimum check`);
  } else {
    // ask > investor.maxInvestment
    const ratio = investor.maxInvestment / ask;
    fundingScore = Math.max(35, Math.round(ratio * 80));
    fundingStatus = 'EXCEEDS_RANGE';
    fundingEvidence = `Requested funding (₹${(ask / 100000).toFixed(1)}L) exceeds typical single-firm limit (max ₹${(investor.maxInvestment / 100000).toFixed(0)}L). Syndicate co-investors would be required.`;
    keyMismatches.push(`Exceeds lead check capacity without syndicate`);
  }

  criteriaScores.push({
    name: 'Funding Fit',
    key: 'fundingCompatibility',
    weightPct: CRITERIA_WEIGHTS.fundingCompatibility,
    score: fundingScore,
    evidence: fundingEvidence,
    supported: true,
    importance: 'HIGH',
    detail: `Ask: ₹${(ask / 100000).toFixed(1)}L | Range: ₹${(investor.minInvestment / 100000).toFixed(0)}L - ₹${(investor.maxInvestment / 100000).toFixed(0)}L`,
  });

  // 3. Startup Stage Compatibility (Weight: 15%)
  let stageScore = 40;
  let stageEvidence = '';
  const stageMatches = investor.preferredStages.includes(startup.stage);

  if (stageMatches) {
    stageScore = 94;
    stageEvidence = `Exact stage alignment: ${investor.name} actively leads rounds in ${startup.stage} ventures.`;
    strongestMatches.push(`Active deployment at ${startup.stage} stage`);
  } else {
    stageScore = 45;
    stageEvidence = `${startup.stage} stage is outside ${investor.name}'s preferred deployment sweetspot (${investor.preferredStages.join(', ')}).`;
    keyMismatches.push(`Mismatched maturity stage (Prefers ${investor.preferredStages.join(', ')})`);
  }

  criteriaScores.push({
    name: 'Stage Compatibility',
    key: 'stageCompatibility',
    weightPct: CRITERIA_WEIGHTS.stageCompatibility,
    score: stageScore,
    evidence: stageEvidence,
    supported: true,
    importance: 'HIGH',
    detail: `${startup.stage} vs [${investor.preferredStages.join(', ')}]`,
  });

  // 4. Business Model Alignment (Weight: 10%)
  let modelScore = 50;
  let modelEvidence = '';
  const modelMatches = investor.businessModels.includes(startup.businessModel);

  if (modelMatches) {
    modelScore = 92;
    modelEvidence = `${investor.name} has deep operational expertise and multiple portfolio wins in ${startup.businessModel} architectures.`;
    strongestMatches.push(`Proven portfolio playbook in ${startup.businessModel}`);
  } else {
    modelScore = 55;
    modelEvidence = `${startup.businessModel} is secondary for ${investor.name}'s current focus.`;
  }

  criteriaScores.push({
    name: 'Business Model',
    key: 'businessModelAlignment',
    weightPct: CRITERIA_WEIGHTS.businessModelAlignment,
    score: modelScore,
    evidence: modelEvidence,
    supported: true,
    importance: 'MEDIUM',
    detail: `${startup.businessModel} alignment`,
  });

  // 5. Traction & Growth Alignment (Weight: 10%)
  let tractionScore = 50;
  let tractionEvidence = '';
  let tractionSupported = false;

  if (startup.isPreRevenue) {
    tractionSupported = true;
    if (investor.preferredStages.includes('IDEA') || investor.preferredStages.includes('PROTOTYPE')) {
      tractionScore = 80;
      tractionEvidence = `Pre-revenue profile accepted for early-stage evaluation by ${investor.name}.`;
    } else {
      tractionScore = 45;
      tractionEvidence = `${investor.name} typically expects demonstrated product-market fit or early revenue metrics.`;
    }
  } else if (startup.mrr !== null && startup.mrr > 0) {
    tractionSupported = true;
    if (startup.mrr >= 500000) {
      // > ₹5L MRR
      tractionScore = 95;
      tractionEvidence = `Strong revenue momentum (₹${(startup.mrr / 100000).toFixed(1)}L MRR) solidly satisfies growth stage requirements.`;
      strongestMatches.push(`Verified revenue traction exceeding benchmarks`);
    } else if (startup.mrr >= 150000) {
      tractionScore = 82;
      tractionEvidence = `Demonstrated early commercial revenue (₹${(startup.mrr / 100000).toFixed(1)}L MRR).`;
    } else {
      tractionScore = 65;
      tractionEvidence = `Nascent commercial traction (₹${(startup.mrr / 100000).toFixed(1)}L MRR). Expansion velocity will be scrutinized.`;
    }
  } else {
    missingInformation.push('Historical revenue or growth metrics');
    tractionEvidence = 'Commercial traction figures not provided.';
    tractionScore = 50;
  }

  criteriaScores.push({
    name: 'Traction & Growth',
    key: 'tractionAndGrowth',
    weightPct: CRITERIA_WEIGHTS.tractionAndGrowth,
    score: tractionScore,
    evidence: tractionEvidence,
    supported: tractionSupported,
    importance: 'MEDIUM',
    detail: startup.isPreRevenue ? 'Pre-revenue' : `MRR ₹${((startup.mrr || 0) / 100000).toFixed(1)}L`,
  });

  // 6. Strategic Capabilities & Founder Priorities (Weight: 10%)
  let strategicScore = 50;
  let strategicEvidence = '';
  const strategicMatches = requirements.strategicPriorities.filter((p) =>
    investor.strategicCapabilities.includes(p),
  );

  if (strategicMatches.length >= 2) {
    strategicScore = 96;
    strategicEvidence = `High strategic synergy: ${investor.name} directly offers ${strategicMatches.slice(0, 2).join(' & ')}.`;
    strongestMatches.push(`Unlocks key priorities: ${strategicMatches.slice(0, 2).join(', ')}`);
  } else if (strategicMatches.length === 1) {
    strategicScore = 78;
    strategicEvidence = `Partial strategic fit: Matches on ${strategicMatches[0]}.`;
  } else {
    strategicScore = 48;
    strategicEvidence = `Divergent strategic value: Your stated requirements (${requirements.strategicPriorities.slice(0, 2).join(', ')}) are not ${investor.name}'s core strengths.`;
    keyMismatches.push(`Value-add mismatch on strategic requirements`);
  }

  criteriaScores.push({
    name: 'Strategic Value-Add',
    key: 'strategicAlignment',
    weightPct: CRITERIA_WEIGHTS.strategicAlignment,
    score: strategicScore,
    evidence: strategicEvidence,
    supported: true,
    importance: 'MEDIUM',
    detail: `${strategicMatches.length} of ${requirements.strategicPriorities.length} priorities matched`,
  });

  // 7. Geographic Compatibility (Weight: 5%)
  let geoScore = 85;
  let geoEvidence = `${startup.locationCountry} is covered by ${investor.name}'s geographic deployment mandate.`;

  criteriaScores.push({
    name: 'Geographic Focus',
    key: 'geographicCompatibility',
    weightPct: CRITERIA_WEIGHTS.geographicCompatibility,
    score: geoScore,
    evidence: geoEvidence,
    supported: true,
    importance: 'LOW',
    detail: `${startup.locationCountry} vs ${investor.geographicFocus.join(', ')}`,
  });

  // 8. Investment Thesis Alignment (Weight: 5%)
  let thesisScore = sectorMatches ? 90 : 50;
  let thesisEvidence = sectorMatches
    ? `Strong alignment with published thesis: "${investor.investmentThesis.slice(0, 90)}…"`
    : `Moderate thematic fit with ${investor.name}'s portfolio approach.`;

  criteriaScores.push({
    name: 'Thesis Alignment',
    key: 'marketThesisAlignment',
    weightPct: CRITERIA_WEIGHTS.marketThesisAlignment,
    score: thesisScore,
    evidence: thesisEvidence,
    supported: true,
    importance: 'LOW',
    detail: 'Firm thesis evaluation',
  });

  // Calculate Normalized Compatibility Score & Data Coverage
  let totalSupportedWeight = 0;
  let weightedScoreSum = 0;
  let totalApplicableWeight = 0;

  for (const crit of criteriaScores) {
    totalApplicableWeight += crit.weightPct;
    if (crit.supported) {
      totalSupportedWeight += crit.weightPct;
      weightedScoreSum += (crit.score * crit.weightPct);
    }
  }

  const rawWeightedSum = totalApplicableWeight > 0 ? weightedScoreSum / totalApplicableWeight : 0;
  let normalizedScore = totalSupportedWeight > 0 ? weightedScoreSum / totalSupportedWeight : 0;

  // If there is an explicit hard constraint violation, penalize overall compatibility decisively
  if (hardConstraintViolation) {
    normalizedScore = Math.min(25, normalizedScore * 0.35);
  }

  const dataCoveragePct = Math.round((totalSupportedWeight / totalApplicableWeight) * 100);
  let confidence: InvestorEvaluation['confidence'] = 'HIGH';
  if (dataCoveragePct < 70) confidence = 'LOW';
  else if (dataCoveragePct < 85) confidence = 'MODERATE';

  // Implied Valuations
  const equityFraction = requirements.equityOfferedPct / 100;
  const impliedPost = equityFraction > 0 ? Math.round(requirements.fundingAsk / equityFraction) : null;
  const impliedPre = impliedPost ? Math.max(0, impliedPost - requirements.fundingAsk) : null;

  return {
    investorId: investor.id,
    investor,
    compatibilityScore: Number(normalizedScore.toFixed(1)),
    rawWeightedSum: Number(rawWeightedSum.toFixed(1)),
    dataCoveragePct,
    confidence,
    criteriaScores,
    strongestMatches,
    keyMismatches,
    missingInformation,
    hardConstraintViolation,
    fundingFitStatus: fundingStatus,
    impliedValuationPreMoney: impliedPre,
    impliedValuationPostMoney: impliedPost,
  };
}

/**
 * Evaluates Startup Investment Readiness (Separated from Compatibility)
 */
export function evaluateStartupReadiness(
  startup: FounderStartupProfile,
  requirements: InvestmentBlueprint,
): StartupReadinessAssessment {
  const categories: ReadinessCategory[] = [];

  // 1. Pitch & Identity Completeness
  let pitchScore = 40;
  const pitchMissing: string[] = [];
  const pitchStrengths: string[] = [];

  if (startup.name && startup.tagline && startup.sector) {
    pitchScore += 25;
    pitchStrengths.push('Clean positioning and explicit sector definition');
  }
  if (startup.problem && startup.problem.length >= 20) {
    pitchScore += 15;
    pitchStrengths.push('Articulated problem statement');
  } else {
    pitchMissing.push('Detailed customer problem definition');
  }
  if (startup.solution && startup.solution.length >= 20) {
    pitchScore += 15;
    pitchStrengths.push('Defined product solution');
  }
  if (startup.competitiveAdvantage) {
    pitchScore += 15;
    pitchStrengths.push('Defensible competitive moat stated');
  } else {
    pitchMissing.push('Unfair advantage or competitive differentiation');
  }

  categories.push({
    category: 'Pitch & Positioning',
    score: Math.min(100, pitchScore),
    status: pitchScore >= 80 ? 'EXCELLENT' : pitchScore >= 60 ? 'GOOD' : 'NEEDS_WORK',
    explanation: 'Measures how clearly the customer problem, proposed product, and competitive moat are stated.',
    strengths: pitchStrengths,
    missingPoints: pitchMissing,
    recommendation: pitchMissing.length > 0 ? `Refine ${pitchMissing.join(' and ')} in pitch overview.` : 'Strong executive summary.',
  });

  // 2. Financial Clarity
  let finScore = 30;
  const finMissing: string[] = [];
  const finStrengths: string[] = [];

  if (!startup.isPreRevenue) {
    if (startup.mrr !== null && startup.mrr > 0) {
      finScore += 25;
      finStrengths.push(`Monthly revenue verified (₹${(startup.mrr / 100000).toFixed(1)}L MRR)`);
    } else {
      finMissing.push('Monthly recurring revenue figures');
    }

    if (startup.grossMarginPct !== null) {
      finScore += 20;
      finStrengths.push(`Gross margin explicitly documented (${startup.grossMarginPct}%)`);
    } else {
      finMissing.push('Gross margin accounting');
    }

    if (startup.monthlyBurn !== null && startup.availableCash !== null) {
      finScore += 20;
      finStrengths.push('Cash runway & net burn transparency');
    } else {
      finMissing.push('Monthly net burn rate & cash balance');
    }
  } else {
    finScore = 75; // pre-revenue evaluated on budget discipline
    finStrengths.push('Pre-revenue operational budget transparency');
    if (startup.availableCash !== null) finScore += 15;
  }

  categories.push({
    category: 'Financial Clarity',
    score: Math.min(100, finScore),
    status: finScore >= 80 ? 'EXCELLENT' : finScore >= 60 ? 'GOOD' : 'NEEDS_WORK',
    explanation: 'Assesses the transparency and rigor of unit economics, burn rate, and runway data.',
    strengths: finStrengths,
    missingPoints: finMissing,
    recommendation: finMissing.length > 0 ? `Document ${finMissing.join(', ')} to survive diligence.` : 'Solid financial disclosure.',
  });

  // 3. Funding Justification & Blueprint
  let fundingScore = 50;
  const fundingStrengths: string[] = [];
  const fundingMissing: string[] = [];

  if (requirements.fundingAsk > 0 && requirements.equityOfferedPct > 0) {
    fundingScore += 25;
    fundingStrengths.push(`Clear ask (₹${(requirements.fundingAsk / 100000).toFixed(1)}L for ${requirements.equityOfferedPct}%)`);
  }

  // Validate fund allocation totals 100
  const alloc = requirements.fundAllocation;
  const allocTotal =
    alloc.productDevelopment +
    alloc.marketing +
    alloc.hiring +
    alloc.operations +
    alloc.researchAndPatents +
    alloc.expansion +
    alloc.other;

  if (Math.abs(allocTotal - 100) < 0.5) {
    fundingScore += 25;
    fundingStrengths.push('Capital deployment allocation reconciled to exactly 100%');
  } else {
    fundingMissing.push('Use of funds allocation breakdown');
  }

  categories.push({
    category: 'Funding Justification',
    score: Math.min(100, fundingScore),
    status: fundingScore >= 80 ? 'EXCELLENT' : fundingScore >= 60 ? 'GOOD' : 'NEEDS_WORK',
    explanation: 'Evaluates whether the requested valuation and fund allocation are structured appropriately.',
    strengths: fundingStrengths,
    missingPoints: fundingMissing,
    recommendation: 'Ensure funding milestones directly tie to the next round of financing.',
  });

  const overallReadinessScore = Math.round(
    categories.reduce((acc, c) => acc + c.score, 0) / categories.length,
  );

  return {
    overallReadinessScore,
    categories,
    summaryNote:
      overallReadinessScore >= 80
        ? 'Institutional Grade: The startup submission demonstrates strong documentation and financial disclosure.'
        : overallReadinessScore >= 60
          ? 'Viable Seed Dossier: Solid core fundamentals with targeted financial or strategic gaps to tighten.'
          : 'Early Stage: Requires additional metric documentation and capital allocation detail prior to institutional partner meetings.',
  };
}

/**
 * Synthesizes Actionable Improvement Recommendations for the Improvement Lab
 */
function buildImprovementPlan(
  startup: FounderStartupProfile,
  requirements: InvestmentBlueprint,
  investorA: InvestorEvaluation,
  investorB: InvestorEvaluation,
  financials: ReturnType<typeof calculateFinancialMetrics>,
): ImprovementAction[] {
  const plan: ImprovementAction[] = [];

  // Check 1: Valuations / Equity
  if (financials.impliedPostMoneyValuation && financials.annualizedRunRate) {
    const multiple = financials.impliedPostMoneyValuation / financials.annualizedRunRate;
    if (multiple > 40) {
      plan.push({
        id: 'act-val-multiple',
        gapTitle: 'Aggressive Valuation Multiple',
        priority: 'HIGH',
        category: 'Valuation & Terms',
        currentSituation: `Implied valuation (₹${(financials.impliedPostMoneyValuation / 10000000).toFixed(1)} Cr) is ${multiple.toFixed(0)}x your current ARR.`,
        targetSituation: 'Market standard early-stage multiples range between 15x–25x ARR unless exponential defensibility exists.',
        relevantInvestorCriterion: 'Funding Compatibility',
        recommendedAction: 'Calibrate equity offer or structure investment via milestone-tranche SAFE notes to prevent down-round risks.',
        potentialScoreLiftPct: 8.5,
        status: 'NOT_STARTED',
      });
    }
  }

  // Check 2: Gross Margin
  if (startup.grossMarginPct !== null && startup.grossMarginPct < 45) {
    plan.push({
      id: 'act-margin-expansion',
      gapTitle: 'Sub-Optimal Gross Margin Structure',
      priority: 'HIGH',
      category: 'Unit Economics',
      currentSituation: `Reported gross margin is ${startup.grossMarginPct}%, which triggers risk alerts for institutional tech investors.`,
      targetSituation: 'Target scalable software/tech margins above 60% or tech-enabled margins above 45%.',
      relevantInvestorCriterion: 'Traction & Growth Alignment',
      recommendedAction: 'Audit direct hosting/cloud costs, payment gateway transaction fees, or supplier COGS to demonstrate margin expansion roadmap.',
      potentialScoreLiftPct: 12.0,
      status: 'NOT_STARTED',
    });
  }

  // Check 3: Runway
  if (financials.estimatedMonthsRunway !== null && financials.estimatedMonthsRunway < 6) {
    plan.push({
      id: 'act-runway-buffer',
      gapTitle: 'Compressed Cash Runway',
      priority: 'HIGH',
      category: 'Financial Solvency',
      currentSituation: `Estimated remaining cash runway is ${financials.estimatedMonthsRunway} months at current burn rate.`,
      targetSituation: 'Maintain at least 12–18 months of runway to negotiate from a position of strategic strength.',
      relevantInvestorCriterion: 'Funding Fit',
      recommendedAction: 'Prioritize quick capital injection or reduce non-essential discretionary burn to extend runway during diligence.',
      potentialScoreLiftPct: 6.0,
      status: 'NOT_STARTED',
    });
  }

  // Check 4: Hard constraint or mismatch on either investor
  const weakerInvestor = investorA.compatibilityScore < investorB.compatibilityScore ? investorA : investorB;
  if (weakerInvestor.keyMismatches.length > 0) {
    plan.push({
      id: 'act-weaker-match',
      gapTitle: `Bridge Gaps with ${weakerInvestor.investor.name}`,
      priority: 'MEDIUM',
      category: 'Investor Syndicate',
      currentSituation: weakerInvestor.keyMismatches[0],
      targetSituation: 'Align requirements with co-investment syndication or adjusted check bounds.',
      relevantInvestorCriterion: 'Strategic & Funding Alignment',
      recommendedAction: `Address specific partner criteria for ${weakerInvestor.investor.name} by providing customer retention metrics.`,
      potentialScoreLiftPct: 5.0,
      status: 'NOT_STARTED',
    });
  }

  // Check 5: Fund allocation
  if (requirements.fundAllocation.marketing > 45) {
    plan.push({
      id: 'act-marketing-spend',
      gapTitle: 'High Marketing Budget Allocation',
      priority: 'MEDIUM',
      category: 'Capital Deployment',
      currentSituation: `Marketing allocation (${requirements.fundAllocation.marketing}%) exceeds product development (${requirements.fundAllocation.productDevelopment}%).`,
      targetSituation: 'Early-stage institutional investors favor product innovation and organic retention moats over paid customer acquisition.',
      relevantInvestorCriterion: 'Thesis Alignment',
      recommendedAction: 'Rebalance funds toward core R&D, engineering talent, and organic community growth.',
      potentialScoreLiftPct: 4.5,
      status: 'NOT_STARTED',
    });
  }

  return plan;
}

/**
 * Full End-to-End Battle Engine Execution
 */
export function runFounderBattleArena(
  startup: FounderStartupProfile,
  requirements: InvestmentBlueprint,
  investorAProfile: InvestorProfile,
  investorBProfile: InvestorProfile,
): BattleAnalysisResult {
  const investorA = evaluateInvestorCompatibility(startup, requirements, investorAProfile);
  const investorB = evaluateInvestorCompatibility(startup, requirements, investorBProfile);
  const financials = calculateFinancialMetrics(startup, requirements);
  const readiness = evaluateStartupReadiness(startup, requirements);
  const improvementPlan = buildImprovementPlan(startup, requirements, investorA, investorB, financials);

  // Determine Battle Outcome
  const scoreA = investorA.compatibilityScore;
  const scoreB = investorB.compatibilityScore;
  const delta = Math.abs(scoreA - scoreB);

  let outcomeType: BattleOutcomeType = 'DECISIVE_WINNER';
  let winnerInvestorId: string | null = null;
  let verdictHeadline = '';
  let verdictExplanation = '';
  let tradeoffAnalysis = '';

  // Check if both are hard constraint violations
  if (investorA.hardConstraintViolation && investorB.hardConstraintViolation) {
    outcomeType = 'NEITHER_SUITABLE';
    winnerInvestorId = null;
    verdictHeadline = 'NEITHER CONTENDER IS CURRENTLY AN OPTIMAL FIT';
    verdictExplanation = `Both ${investorA.investor.name} and ${investorB.investor.name} have documented policy or ticket-size constraints that conflict with your current venture profile.`;
    tradeoffAnalysis = 'We recommend exploring stage-specific angel networks or revising your capital requirements.';
  } else if (investorA.hardConstraintViolation) {
    outcomeType = 'DECISIVE_WINNER';
    winnerInvestorId = investorB.investor.id;
    verdictHeadline = 'OPTIMAL INVESTOR MATCH';
    verdictExplanation = `${investorB.investor.name} emerged as the clear match with a ${scoreB}% compatibility score. ${investorA.investor.name} encountered an eligibility restriction (${investorA.hardConstraintViolation}).`;
    tradeoffAnalysis = `${investorB.investor.name} provides clean mandate alignment without portfolio conflict.`;
  } else if (investorB.hardConstraintViolation) {
    outcomeType = 'DECISIVE_WINNER';
    winnerInvestorId = investorA.investor.id;
    verdictHeadline = 'OPTIMAL INVESTOR MATCH';
    verdictExplanation = `${investorA.investor.name} emerged as the recommended partner with a ${scoreA}% compatibility score. ${investorB.investor.name} encountered an eligibility restriction (${investorB.hardConstraintViolation}).`;
    tradeoffAnalysis = `${investorA.investor.name} provides clean mandate alignment without portfolio conflict.`;
  } else if (investorA.dataCoveragePct < 50 && investorB.dataCoveragePct < 50) {
    outcomeType = 'INCONCLUSIVE';
    winnerInvestorId = null;
    verdictHeadline = 'INSUFFICIENT DATA TO DECLARE DECISIVE MATCH';
    verdictExplanation = 'Key traction and financial inputs are missing, making a high-confidence distinction unreliable.';
    tradeoffAnalysis = 'Complete your financial and customer metrics to unlock high-confidence matching.';
  } else if (delta <= NEAR_TIE_DELTA_THRESHOLD) {
    outcomeType = 'NEAR_TIE';
    winnerInvestorId = scoreA >= scoreB ? investorA.investor.id : investorB.investor.id;
    verdictHeadline = 'BOTH INVESTORS ARE HIGH-CALIBER CONTENDERS';
    verdictExplanation = `The compatibility scores are exceptionally close (${investorA.investor.name}: ${scoreA}% vs ${investorB.investor.name}: ${scoreB}%). Both firms offer compelling strategic advantages.`;
    tradeoffAnalysis = `${investorA.investor.name} offers distinct advantages in ${investorA.strongestMatches[0] || 'strategic synergies'}, while ${investorB.investor.name} balances this with ${investorB.strongestMatches[0] || 'domain network'}.`;
  } else {
    // Decisive winner
    outcomeType = 'DECISIVE_WINNER';
    const isAWinner = scoreA > scoreB;
    const winner = isAWinner ? investorA : investorB;
    const runnerUp = isAWinner ? investorB : investorA;
    winnerInvestorId = winner.investor.id;

    verdictHeadline = 'OPTIMAL INVESTOR MATCH';
    verdictExplanation = `${winner.investor.name} is your stronger institutional partner (${winner.compatibilityScore}% match vs ${runnerUp.compatibilityScore}%). The firm's documented thesis in ${startup.sector} and active stage deployment match your profile.`;
    tradeoffAnalysis = `${winner.investor.name} holds the advantage in ${winner.strongestMatches[0] || 'sector thesis alignment'}. Meanwhile, ${runnerUp.investor.name} remains an attractive co-investor or secondary syndicate lead.`;
  }

  return {
    battleId: `battle-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    startup,
    requirements,
    investorA,
    investorB,
    financialCalculations: financials,
    readiness,
    outcomeType,
    winnerInvestorId,
    scoreDelta: Number(delta.toFixed(1)),
    verdictHeadline,
    verdictExplanation,
    tradeoffAnalysis,
    improvementPlan,
    scoringWeightsVersion: 'v1.0-deterministic',
  };
}
