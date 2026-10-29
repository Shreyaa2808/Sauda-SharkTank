import type {
  FounderStartupProfile,
  InvestmentBlueprint,
  FinancialCalculations,
} from '../types/arena.ts';

/**
 * Deterministic Financial Calculations Engine
 * Follows rigorous mathematical formulas with validation, explicit units and clean handling of pre-revenue / zero values.
 */

export function calculateFinancialMetrics(
  startup: FounderStartupProfile,
  requirements: InvestmentBlueprint,
): FinancialCalculations {
  // 1. Post-Money and Pre-Money Implied Valuations
  let impliedPostMoney: number | null = null;
  let impliedPreMoney: number | null = null;

  if (
    requirements.fundingAsk > 0 &&
    requirements.equityOfferedPct > 0 &&
    requirements.equityOfferedPct <= 100
  ) {
    const equityFraction = requirements.equityOfferedPct / 100;
    impliedPostMoney = Math.round(requirements.fundingAsk / equityFraction);
    impliedPreMoney = Math.max(0, impliedPostMoney - requirements.fundingAsk);
  }

  // 2. Annualized Run Rate (ARR)
  let annualizedRunRate: number | null = null;
  if (startup.mrr !== null && startup.mrr > 0) {
    annualizedRunRate = startup.mrr * 12;
  } else if (startup.arr !== null && startup.arr > 0) {
    annualizedRunRate = startup.arr;
  }

  // 3. Gross Margin
  const grossMargin = startup.grossMarginPct !== null ? startup.grossMarginPct : null;

  // 4. LTV to CAC Ratio
  let ltvToCacRatio: number | null = null;
  if (
    startup.ltv !== null &&
    startup.cac !== null &&
    startup.cac > 0 &&
    startup.ltv > 0
  ) {
    ltvToCacRatio = Number((startup.ltv / startup.cac).toFixed(2));
  }

  // 5. Estimated Months of Runway
  let estimatedMonthsRunway: number | null = null;
  if (startup.cashRunwayMonths !== null && startup.cashRunwayMonths > 0) {
    estimatedMonthsRunway = startup.cashRunwayMonths;
  } else if (
    startup.availableCash !== null &&
    startup.monthlyBurn !== null &&
    startup.monthlyBurn > 0
  ) {
    estimatedMonthsRunway = Number((startup.availableCash / startup.monthlyBurn).toFixed(1));
  }

  // 6. Revenue Growth %
  let revenueGrowthPct: number | null = null;
  if (startup.revenueGrowthMoM !== null) {
    revenueGrowthPct = startup.revenueGrowthMoM;
  } else if (
    startup.currentQuarterRevenue !== null &&
    startup.previousQuarterRevenue !== null &&
    startup.previousQuarterRevenue > 0
  ) {
    revenueGrowthPct = Number(
      (
        ((startup.currentQuarterRevenue - startup.previousQuarterRevenue) /
          startup.previousQuarterRevenue) *
        100
      ).toFixed(1),
    );
  }

  // 7. Net Burn Multiple
  // Burn Multiple = Net Burn / Net New ARR
  let burnMultiple: number | null = null;
  if (
    startup.monthlyBurn !== null &&
    startup.monthlyBurn > 0 &&
    annualizedRunRate !== null &&
    revenueGrowthPct !== null &&
    revenueGrowthPct > 0
  ) {
    const annualBurn = startup.monthlyBurn * 12;
    const netNewArr = annualizedRunRate * (revenueGrowthPct / 100);
    if (netNewArr > 0) {
      burnMultiple = Number((annualBurn / netNewArr).toFixed(2));
    }
  }

  // 8. Capital Efficiency Score (0-100 composite index)
  let capitalEfficiencyScore = 50; // base default
  let bonus = 0;
  let penalty = 0;

  if (grossMargin !== null) {
    if (grossMargin >= 70) bonus += 20;
    else if (grossMargin >= 50) bonus += 10;
    else if (grossMargin < 25) penalty += 15;
  }

  if (ltvToCacRatio !== null) {
    if (ltvToCacRatio >= 4.0) bonus += 20;
    else if (ltvToCacRatio >= 3.0) bonus += 15;
    else if (ltvToCacRatio < 1.5) penalty += 20;
  }

  if (estimatedMonthsRunway !== null) {
    if (estimatedMonthsRunway >= 12) bonus += 10;
    else if (estimatedMonthsRunway < 4) penalty += 15;
  }

  if (revenueGrowthPct !== null) {
    if (revenueGrowthPct >= 20) bonus += 15;
    else if (revenueGrowthPct >= 10) bonus += 8;
  }

  capitalEfficiencyScore = Math.max(10, Math.min(98, capitalEfficiencyScore + bonus - penalty));

  return {
    impliedPostMoneyValuation: impliedPostMoney,
    impliedPreMoneyValuation: impliedPreMoney,
    annualizedRunRate,
    ltvToCacRatio,
    estimatedMonthsRunway,
    grossMargin,
    revenueGrowthPct,
    burnMultiple,
    capitalEfficiencyScore,
  };
}
