export function formatCurrency(value: string | number | null): string {
  if (value === null || value === undefined || value === '') {
    return 'Not specified';
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return 'Not specified';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export const formatCurrencyINR = formatCurrency;

/**
 * Format an equity percentage with controlled precision (trailing zeros trimmed).
 * Per-pitch values keep up to 2 decimals; aggregates should pass 1.
 */
export function formatEquity(value: string | number | null, maxDecimals: number = 2): string {
  if (value === null || value === undefined || value === '') {
    return 'Not specified';
  }

  const equity = Number(value);
  if (!Number.isFinite(equity)) return 'Not specified';

  const rounded = Number(equity.toFixed(maxDecimals));
  return `${rounded.toLocaleString('en-IN', { maximumFractionDigits: maxDecimals })}%`;
}

/**
 * Compact Indian-convention INR for KPI tiles: ₹4.5 L, ₹12.3 Cr (full grouping below ₹1 lakh).
 */
export function formatCurrencyCompact(value: string | number | null): string {
  if (value === null || value === undefined || value === '') return 'Not specified';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not specified';

  const abs = Math.abs(amount);
  const trim = (n: number) => Number(n.toFixed(2)).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  if (abs >= 1e7) return `₹${trim(amount / 1e7)} Cr`;
  if (abs >= 1e5) return `₹${trim(amount / 1e5)} L`;
  return formatCurrency(amount);
}

export function formatPitchNumber(id: number): string {
  return `PITCH #${String(id).padStart(3, '0')}`;
}

export function formatStageName(stage: string | null): string {
  if (!stage) return '';
  return stage
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getSafeExternalUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

