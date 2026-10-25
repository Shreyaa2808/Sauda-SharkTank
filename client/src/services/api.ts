import type { StartupResponse } from '../types/startup.ts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function fetchStartups(
  limit: number = 50,
  signal?: AbortSignal,
): Promise<StartupResponse> {
  const url = `${API_BASE_URL}/api/startups?limit=${limit}`;

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`API responded with status: ${response.status}`);
  }

  const result: StartupResponse = await response.json();

  if (!result || !Array.isArray(result.data)) {
    throw new Error('API returned an invalid data payload');
  }

  return result;
}

export async function checkApiHealth(signal?: AbortSignal): Promise<{
  ok: boolean;
  database: 'connected' | 'disconnected';
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health/db`, { signal });
    if (!res.ok) {
      return { ok: false, database: 'disconnected' };
    }
    const data = await res.json();
    return {
      ok: data.status === 'ok',
      database: data.database === 'connected' ? 'connected' : 'disconnected',
    };
  } catch {
    return { ok: false, database: 'disconnected' };
  }
}
