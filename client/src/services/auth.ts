export interface AuthUser {
  userId: number;
  fullName: string;
  email: string;
  roles: string[];
}

export interface SessionState {
  authenticated: boolean;
  user: AuthUser | null;
}

export interface AuthErrorResponse {
  error: string;
  message: string;
}

const SESSION_CHECK_TIMEOUT_MS = 10000;

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Check if the browser holds a valid authenticated session cookie.
 */
export async function checkSession(signal?: AbortSignal): Promise<SessionState> {
  // A hung API must never leave the app on the bootstrap loader: give up after SESSION_CHECK_TIMEOUT_MS
  // and treat the visitor as signed out (the backend still enforces every protected request).
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), SESSION_CHECK_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return { authenticated: false, user: null };
    }

    const data = await res.json();
    return {
      authenticated: Boolean(data.authenticated && data.user),
      user: data.user || null,
    };
  } catch (err) {
    // Caller-initiated aborts propagate; timeouts and network failures resolve as signed out.
    if (signal?.aborted && err instanceof Error && err.name === 'AbortError') throw err;
    return { authenticated: false, user: null };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Submit verified Google ID token to backend for server-side verification and session issuance.
 */
export async function loginWithGoogle(
  credential: string,
): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string; message: string; status: number }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ credential }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'AUTHENTICATION_FAILED',
        message: data.message || 'Authentication with Google failed. Please try again.',
        status: res.status,
      };
    }

    return {
      ok: true,
      user: data.user,
    };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Unable to reach the Sauda authentication server. Please check your network connection.',
      status: 0,
    };
  }
}

/**
 * End current authenticated session and clear the session cookie.
 */
export async function logout(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface UserProfile {
  userId: number;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  accountStatus: string;
  createdAt: string | null;
  roles: string[];
  googleSubjectMasked?: string | null;
}

/**
 * Fetch full profile details for the authenticated user.
 */
export async function fetchUserProfile(
  signal?: AbortSignal,
): Promise<{ ok: true; user: UserProfile } | { ok: false; error: string; message: string; status: number }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
      signal,
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'UNAUTHORIZED',
        message: data.message || 'Unable to retrieve user profile.',
        status: res.status,
      };
    }

    return {
      ok: true,
      user: data.user,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Unable to reach the server. Please check your network connection.',
      status: 0,
    };
  }
}

/**
 * Update authenticated user's display name and phone number.
 */
export async function updateUserProfile(
  payload: { fullName: string; phoneNumber: string | null },
): Promise<{ ok: true; user: UserProfile; message: string } | { ok: false; error: string; message: string; status: number }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'UPDATE_FAILED',
        message: data.message || 'Failed to update profile.',
        status: res.status,
      };
    }

    return {
      ok: true,
      user: data.user,
      message: data.message || 'Profile updated successfully.',
    };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network request failed. Please check your connection.',
      status: 0,
    };
  }
}

