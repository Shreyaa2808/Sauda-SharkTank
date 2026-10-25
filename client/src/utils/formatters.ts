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

export function formatEquity(value: string | number | null): string {
  if (value === null || value === undefined || value === '') {
    return 'Not specified';
  }

  const equity = Number(value);
  return Number.isFinite(equity) ? `${equity}%` : 'Not specified';
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

