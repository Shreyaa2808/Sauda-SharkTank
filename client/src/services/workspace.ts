import type {
  MetadataCategories,
  FounderMetrics,
  FounderPitch,
  CreatePitchPayload,
  InvestorDashboardMetrics,
  InvestorPitchItem,
  InvestorPitchesFilter,
  ConnectionRequestItem,
  ConversationDetail,
  ChatMessageItem,
  FounderReviewEvent,
  FounderProfileData,
  InvestorProfileData,
  ArchiveSummary,
} from '../types/workspace.ts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Fetch available industry categories and startup stages for pitch forms & filters.
 */
export async function fetchCategories(signal?: AbortSignal): Promise<MetadataCategories> {
  const res = await fetch(`${API_BASE_URL}/api/meta/categories`, { signal });
  if (!res.ok) {
    throw new Error(`Failed to load categories: ${res.status}`);
  }
  const data = await res.json();
  return {
    industries: data.industries || [],
    stages: data.stages || [],
  };
}

/**
 * Self-service activation of workspace role (FOUNDER or INVESTOR).
 */
export async function activateWorkspaceRole(
  role: 'FOUNDER' | 'INVESTOR',
): Promise<{ ok: true; roles: string[] } | { ok: false; error: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/roles/activate`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ role }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'ACTIVATION_FAILED',
        message: data.message || 'Failed to activate workspace role.',
      };
    }

    return {
      ok: true,
      roles: data.roles,
    };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network error communicating with Sauda server.',
    };
  }
}

// ============================================================================
// FOUNDER SERVICE
// ============================================================================

export async function fetchFounderDashboard(signal?: AbortSignal): Promise<{
  metrics: FounderMetrics;
  pitches: FounderPitch[];
}> {
  const res = await fetch(`${API_BASE_URL}/api/founder/pitches`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch founder dashboard: ${res.status}`);
  }

  const data = await res.json();
  return {
    metrics: data.metrics,
    pitches: data.pitches || [],
  };
}

export async function fetchFounderPitchReviewHistory(
  pitchId: number,
  signal?: AbortSignal,
): Promise<FounderReviewEvent[]> {
  const res = await fetch(`${API_BASE_URL}/api/founder/pitches/${pitchId}/reviews`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Failed to fetch review feedback: ${res.status}`);
  return Array.isArray(data.history) ? data.history as FounderReviewEvent[] : [];
}

export async function createFounderPitch(
  payload: CreatePitchPayload,
): Promise<{ ok: true; pitch: FounderPitch } | { ok: false; error: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/founder/pitches`, {
      method: 'POST',
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
        error: data.error || 'CREATE_FAILED',
        message: data.message || 'Failed to create startup pitch.',
      };
    }

    return { ok: true, pitch: data.pitch };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network error connecting to the Sauda server.',
    };
  }
}

export async function updateFounderPitch(
  pitchId: number,
  payload: Partial<CreatePitchPayload>,
): Promise<{ ok: true; pitch: FounderPitch } | { ok: false; error: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/founder/pitches/${pitchId}`, {
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
        message: data.message || 'Failed to update startup pitch.',
      };
    }

    return { ok: true, pitch: data.pitch };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network error connecting to the Sauda server.',
    };
  }
}

export async function archiveFounderPitch(
  pitchId: number,
): Promise<{ ok: true; pitch: FounderPitch; summary: ArchiveSummary; message: string } | { ok: false; error: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/founder/pitches/${pitchId}/archive`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'ARCHIVE_FAILED',
        message: data.message || 'Failed to archive pitch.',
      };
    }

    return {
      ok: true,
      pitch: data.pitch,
      summary: data.summary,
      message: data.message || 'Pitch archived successfully.',
    };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network error connecting to the Sauda server.',
    };
  }
}

export async function fetchFounderProfile(signal?: AbortSignal): Promise<FounderProfileData> {
  const res = await fetch(`${API_BASE_URL}/api/founder/profile`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to fetch founder profile: ${res.status}`);
  }
  return data.profile as FounderProfileData;
}

export async function updateFounderProfile(
  payload: Partial<FounderProfileData>,
): Promise<{ ok: true; profile: FounderProfileData; message: string } | { ok: false; error: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/founder/profile`, {
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
        error: data.error || 'UPDATE_PROFILE_FAILED',
        message: data.message || 'Failed to update founder profile.',
      };
    }

    return {
      ok: true,
      profile: data.profile,
      message: data.message || 'Founder profile updated successfully.',
    };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network error connecting to the Sauda server.',
    };
  }
}

// ============================================================================
// INVESTOR SERVICE
// ============================================================================

export async function fetchInvestorDashboard(signal?: AbortSignal): Promise<InvestorDashboardMetrics> {
  const res = await fetch(`${API_BASE_URL}/api/investor/dashboard`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch investor dashboard: ${res.status}`);
  }

  const data = await res.json();
  return data.metrics;
}

export async function fetchInvestorPitches(
  filters: InvestorPitchesFilter = {},
  signal?: AbortSignal,
): Promise<InvestorPitchItem[]> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.industry) params.set('industry', filters.industry);
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.source && filters.source !== 'ALL') params.set('source', filters.source);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.savedOnly) params.set('savedOnly', 'true');

  const res = await fetch(`${API_BASE_URL}/api/investor/pitches?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch investor deals: ${res.status}`);
  }

  const data = await res.json();
  return data.data || [];
}

export async function toggleInvestorWatchlist(
  pitchId: number,
): Promise<{ ok: true; saved: boolean } | { ok: false; error: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/investor/watchlist/toggle`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ pitchId }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'WATCHLIST_ERROR',
        message: data.message || 'Failed to update watchlist.',
      };
    }

    return { ok: true, saved: data.saved };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network error connecting to the Sauda server.',
    };
  }
}

export async function fetchInvestorProfile(signal?: AbortSignal): Promise<InvestorProfileData> {
  const res = await fetch(`${API_BASE_URL}/api/investor/profile`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Failed to fetch investor profile: ${res.status}`);
  }
  return data.profile as InvestorProfileData;
}

export async function updateInvestorProfile(
  payload: Partial<InvestorProfileData>,
): Promise<{ ok: true; profile: InvestorProfileData; message: string } | { ok: false; error: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/investor/profile`, {
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
        error: data.error || 'UPDATE_PROFILE_FAILED',
        message: data.message || 'Failed to update investor preferences.',
      };
    }

    return {
      ok: true,
      profile: data.profile,
      message: data.message || 'Investor preferences updated successfully.',
    };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network error connecting to the Sauda server.',
    };
  }
}

// ============================================================================
// CONNECTIONS & MESSAGING SERVICE
// ============================================================================

export async function sendConnectionRequest(
  pitchId: number,
  initialMessage?: string,
): Promise<{ ok: true; request: ConnectionRequestItem } | { ok: false; error: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/connections/request`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ pitchId, initialMessage }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'REQUEST_FAILED',
        message: data.message || 'Failed to initiate connection request.',
      };
    }

    return { ok: true, request: data.request };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network error connecting to the Sauda server.',
    };
  }
}

export async function fetchConnections(signal?: AbortSignal): Promise<{
  incoming: ConnectionRequestItem[];
  sent: ConnectionRequestItem[];
  active: ConnectionRequestItem[];
  ended: ConnectionRequestItem[];
}> {
  const res = await fetch(`${API_BASE_URL}/api/connections`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch connections: ${res.status}`);
  }

  const data = await res.json();
  return {
    incoming: data.incoming || [],
    sent: data.sent || [],
    active: data.active || [],
    ended: data.ended || [],
  };
}

export async function respondToConnectionRequest(
  requestId: number,
  action: 'ACCEPT' | 'DECLINE',
  reason?: string,
): Promise<{ ok: true; request: ConnectionRequestItem } | { ok: false; error: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/connections/${requestId}/respond`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ action, reason }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'ACTION_FAILED',
        message: data.message || 'Failed to process request action.',
      };
    }

    return { ok: true, request: data.request };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network error connecting to the Sauda server.',
    };
  }
}

export async function endConnection(
  requestId: number,
): Promise<{ ok: true; request: ConnectionRequestItem } | { ok: false; error: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/connections/${requestId}/end`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'END_FAILED',
        message: data.message || 'Failed to end connection.',
      };
    }

    return { ok: true, request: data.request };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network error connecting to the Sauda server.',
    };
  }
}

export async function withdrawConnectionRequest(
  requestId: number,
  reason?: string,
): Promise<{ ok: true; request: ConnectionRequestItem; message: string } | { ok: false; error: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/connections/${requestId}/withdraw`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ reason: reason?.trim() || undefined }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'WITHDRAW_FAILED',
        message: data.message || 'Failed to withdraw connection request.',
      };
    }

    return {
      ok: true,
      request: data.request,
      message: data.message || 'Connection request withdrawn.',
    };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network error connecting to the Sauda server.',
    };
  }
}

export async function fetchConversation(
  conversationId: number,
  signal?: AbortSignal,
): Promise<ConversationDetail> {
  const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch conversation: ${res.status}`);
  }

  return await res.json();
}

export async function sendChatMessage(
  conversationId: number,
  messageBody: string,
): Promise<{ ok: true; message: ChatMessageItem } | { ok: false; error: string; message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ messageBody }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'SEND_FAILED',
        message: data.message || 'Failed to send message.',
      };
    }

    return { ok: true, message: data.message };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network error sending message.',
    };
  }
}
