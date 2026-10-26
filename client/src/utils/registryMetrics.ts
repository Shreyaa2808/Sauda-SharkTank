import type { Startup } from '../types/startup.ts';

export interface RegistryMetrics {
  totalCount: number;
  showCount: number;
  platformCount: number;
  /** Sum of stated asks; null when no pitch states a valid ask. */
  totalAsk: number | null;
  askSampleCount: number;
  /** Mean of valid equity values only; null when none are stated. */
  avgEquity: number | null;
  equitySampleCount: number;
}

const toPositiveNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Derive KPI values strictly from the published-startup records.
 * Missing / invalid values are excluded from sums and averages rather than counted as zero.
 */
export function computeRegistryMetrics(startups: Startup[]): RegistryMetrics {
  let showCount = 0;
  let platformCount = 0;
  let askTotal = 0;
  let askSampleCount = 0;
  let equityTotal = 0;
  let equitySampleCount = 0;

  for (const s of startups) {
    if (s.pitchType === 'SHOW') showCount += 1;
    else if (s.pitchType === 'PLATFORM') platformCount += 1;

    const ask = toPositiveNumber(s.originalAskAmount);
    if (ask !== null) {
      askTotal += ask;
      askSampleCount += 1;
    }

    const equity = toPositiveNumber(s.originalAskEquityPct);
    if (equity !== null && equity <= 100) {
      equityTotal += equity;
      equitySampleCount += 1;
    }
  }

  return {
    totalCount: startups.length,
    showCount,
    platformCount,
    totalAsk: askSampleCount > 0 ? askTotal : null,
    askSampleCount,
    avgEquity: equitySampleCount > 0 ? equityTotal / equitySampleCount : null,
    equitySampleCount,
  };
}
