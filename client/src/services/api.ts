import type { StartupResponse } from '../types/startup.ts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const STARTUPS_TIMEOUT_MS = 12000;

export async function fetchStartups(
  limit: number = 50,
  signal?: AbortSignal,
): Promise<StartupResponse> {
  const url = `${API_BASE_URL}/api/startups?limit=${limit}`;

  // A hung API must surface as an error with a Retry action, never an endless loader.
  // Caller-initiated aborts keep the AbortError name so the caller can ignore them.
  const controller = new AbortController();
  let timedOut = false;
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, STARTUPS_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const result: StartupResponse = await response.json();

    if (!result || !Array.isArray(result.data)) {
      throw new Error('API returned an invalid data payload');
    }

    return result;
  } catch (err) {
    if (timedOut && !signal?.aborted) {
      throw new Error('The startup registry took too long to respond.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
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
