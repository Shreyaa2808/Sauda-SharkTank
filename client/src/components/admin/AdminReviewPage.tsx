import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './AdminReviewPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const MIN_REJECTION_NOTE_LENGTH = 10;

type ReviewDecision = 'PUBLISH' | 'REJECT';
type PitchStatus = 'SUBMITTED' | 'PUBLISHED' | 'REJECTED' | 'DRAFT' | 'ARCHIVED';

interface ReviewPitch {
  pitchId: number;
  companyId: number;
  brandName: string;
  legalBusinessName: string | null;
  businessModel: string | null;
  websiteUrl: string | null;
  foundedYear: number | null;
  headquartersCity: string | null;
  headquartersState: string | null;
  headquartersCountry: string | null;
  industryName: string | null;
  stageName: string | null;
  originalAskAmount: number | string | null;
  originalAskEquityPct: number | string | null;
  pitchHook: string | null;
  pitchStatus: PitchStatus;
  submittedAt: string;
  founderUserId: number;
  founderName: string;
}

interface ReviewHistoryItem {
  reviewEventId: number;
  pitchId: number;
  decision: ReviewDecision;
  reviewNote: string | null;
  decidedAt: string;
  reviewerUserId: number;
  reviewerName: string;
}

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

async function readApiError(response: Response, fallback: string): Promise<Error> {
  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
  return new Error(payload.message || fallback);
}

async function fetchReviewQueue(signal?: AbortSignal): Promise<ReviewPitch[]> {
  const response = await fetch(`${API_BASE_URL}/api/admin/reviews`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw await readApiError(response, `Unable to load review queue (${response.status}).`);
  const payload = (await response.json()) as { data?: ReviewPitch[] };
  return Array.isArray(payload.data) ? payload.data : [];
}

async function fetchReviewDetail(pitchId: number, signal?: AbortSignal): Promise<{ pitch: ReviewPitch; history: ReviewHistoryItem[] }> {
  const response = await fetch(`${API_BASE_URL}/api/admin/reviews/${pitchId}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw await readApiError(response, `Unable to load pitch details (${response.status}).`);
  const payload = (await response.json()) as { pitch: ReviewPitch; history?: ReviewHistoryItem[] };
  return { pitch: payload.pitch, history: Array.isArray(payload.history) ? payload.history : [] };
}

async function submitDecision(pitchId: number, decision: ReviewDecision, note: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/admin/reviews/${pitchId}/decision`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ decision, note }),
  });
  if (!response.ok) throw await readApiError(response, `Unable to save review decision (${response.status}).`);
}

function formatAsk(value: number | string | null): string {
  if (value === null || value === '') return 'Not specified';
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Not specified';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(number);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

interface AdminReviewPageProps {
  authorized: boolean;
  onReturnToDashboard: () => void;
}

export const AdminReviewPage: React.FC<AdminReviewPageProps> = ({ authorized, onReturnToDashboard }) => {
  const [queue, setQueue] = useState<ReviewPitch[]>([]);
  const [selectedPitchId, setSelectedPitchId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ pitch: ReviewPitch; history: ReviewHistoryItem[] } | null>(null);
  const [queueLoading, setQueueLoading] = useState(authorized);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [note, setNote] = useState('');
  const [decisionBusy, setDecisionBusy] = useState<ReviewDecision | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const refreshQueue = useCallback(async (signal?: AbortSignal) => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const rows = await fetchReviewQueue(signal);
      if (signal?.aborted) return;
      setQueue(rows);
      setSelectedPitchId((current) => (current && rows.some((row) => row.pitchId === current) ? current : rows[0]?.pitchId ?? null));
    } catch (error) {
      if (signal?.aborted) return;
      setQueueError(error instanceof Error ? error.message : 'Unable to load the Admin review queue.');
    } finally {
      if (!signal?.aborted) setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authorized) return;
    const controller = new AbortController();
    void refreshQueue(controller.signal);
    return () => controller.abort();
  }, [authorized, refreshQueue]);

  useEffect(() => {
    if (!authorized || selectedPitchId === null) {
      return;
    }
    const controller = new AbortController();
    void (async () => {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(true);
      try {
        const value = await fetchReviewDetail(selectedPitchId, controller.signal);
        if (!controller.signal.aborted) {
          setDetail(value);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setDetailError(error instanceof Error ? error.message : 'Unable to load pitch details.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    })();
    return () => controller.abort();
  }, [authorized, selectedPitchId, detailReloadKey]);

  const visibleQueue = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return queue;
    return queue.filter((pitch) => [pitch.brandName, pitch.legalBusinessName, pitch.founderName, pitch.industryName, pitch.headquartersCity]
      .filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [queue, search]);

  const handleDecision = async (decision: ReviewDecision) => {
    if (!detail || decisionBusy) return;
    const trimmedNote = note.trim();
    if (decision === 'REJECT' && trimmedNote.length < MIN_REJECTION_NOTE_LENGTH) {
      setDecisionError(`Please provide at least ${MIN_REJECTION_NOTE_LENGTH} characters explaining the rejection.`);
      return;
    }
    const verb = decision === 'PUBLISH' ? 'publish' : 'reject';
    if (!window.confirm(`Are you sure you want to ${verb} “${detail.pitch.brandName}”?`)) return;

    setDecisionBusy(decision);
    setDecisionError(null);
    setNotice(null);
    try {
      await submitDecision(detail.pitch.pitchId, decision, trimmedNote);
      setNotice(decision === 'PUBLISH' ? `${detail.pitch.brandName} was published.` : `${detail.pitch.brandName} was rejected and feedback was recorded.`);
      setNote('');
      await refreshQueue();
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : 'Unable to save the review decision.');
    } finally {
      setDecisionBusy(null);
    }
  };

  if (!authorized) {
    return (
      <section className="admin-review-page admin-review-access-denied" aria-labelledby="admin-review-denied-title">
        <div className="admin-review-access-card">
          <span className="admin-review-eyebrow">SAUDA · ADMINISTRATION</span>
          <h1 id="admin-review-denied-title">Administrator access required</h1>
          <p>This review queue is restricted to accounts with the server-assigned ADMIN role.</p>
          <button type="button" className="admin-review-button secondary" onClick={onReturnToDashboard}>Return to Dashboard</button>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-review-page" aria-labelledby="admin-review-title">
      <header className="admin-review-header">
        <div>
          <span className="admin-review-eyebrow">SAUDA · MODERATION</span>
          <h1 id="admin-review-title">Pitch Review Queue<span>.</span></h1>
          <p>Review founder submissions before they appear in the public registry.</p>
        </div>
        <div className="admin-review-header-count" aria-live="polite">
          <strong>{queueLoading ? '—' : queue.length.toString().padStart(2, '0')}</strong>
          <span>AWAITING REVIEW</span>
        </div>
      </header>

      {notice && <div className="admin-review-notice" role="status">{notice}</div>}
      {queueError && (
        <div className="admin-review-error" role="alert">
          <p>{queueError}</p>
          <button type="button" className="admin-review-button secondary" onClick={() => void refreshQueue()}>Retry queue</button>
        </div>
      )}

      <div className="admin-review-layout">
        <aside className="admin-review-queue-panel" aria-label="Submitted platform pitches">
          <div className="admin-review-queue-heading">
            <div>
              <h2>Awaiting decision</h2>
              <p>{queue.length} {queue.length === 1 ? 'submission' : 'submissions'}</p>
            </div>
          </div>
          <label className="admin-review-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Search pending submissions</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search venture or founder" />
          </label>
          {queueLoading ? (
            <div className="admin-review-state" role="status">Loading submitted pitches…</div>
          ) : !queueError && visibleQueue.length === 0 ? (
            <div className="admin-review-state">
              <span className="admin-review-state-mark">✓</span>
              <strong>{search.trim() ? 'No matching submissions' : 'Queue is clear'}</strong>
              <p>{search.trim() ? 'Try a different search term.' : 'There are no submitted platform pitches awaiting review.'}</p>
            </div>
          ) : (
            <div className="admin-review-queue-list">
              {visibleQueue.map((pitch) => (
                <button
                  type="button"
                  key={pitch.pitchId}
                  className={`admin-review-queue-item ${selectedPitchId === pitch.pitchId ? 'selected' : ''}`}
                  aria-pressed={selectedPitchId === pitch.pitchId}
                  onClick={() => { setSelectedPitchId(pitch.pitchId); setDecisionError(null); setNote(''); }}
                >
                  <span className="admin-review-queue-item-top">
                    <span className="admin-review-queue-badge">PLATFORM</span>
                    <span className="admin-review-queue-id">#{pitch.pitchId}</span>
                  </span>
                  <strong>{pitch.brandName}</strong>
                  <span className="admin-review-queue-founder">{pitch.founderName}</span>
                  <span className="admin-review-queue-meta">{pitch.industryName || 'Industry not specified'} · {formatDate(pitch.submittedAt)}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="admin-review-detail-panel" aria-label="Selected pitch details" aria-busy={detailLoading || Boolean(decisionBusy)}>
          {detailLoading ? (
            <div className="admin-review-state">Loading pitch details…</div>
          ) : detailError ? (
            <div className="admin-review-state admin-review-state-error" role="alert">
              <strong>Unable to load review details</strong>
              <p>{detailError}</p>
              <p className="admin-review-migration-hint">If the review-history migration is still a draft, review actions remain unavailable until it is approved and applied to the intended database.</p>
              {selectedPitchId !== null && <button type="button" className="admin-review-button secondary" onClick={() => setDetailReloadKey((key) => key + 1)}>Retry details</button>}
            </div>
          ) : !detail ? (
            <div className="admin-review-state admin-review-detail-empty">
              <span className="admin-review-state-mark">◎</span>
              <strong>Select a submission</strong>
              <p>Choose a pitch from the queue to inspect its details and make a decision.</p>
            </div>
          ) : (
            <article className="admin-review-pitch-detail">
              <div className="admin-review-detail-topline">
                <span className="admin-review-eyebrow">SUBMISSION #{detail.pitch.pitchId}</span>
                <span className={`admin-review-status ${detail.pitch.pitchStatus.toLowerCase()}`}>{detail.pitch.pitchStatus.replace('_', ' ')}</span>
              </div>
              <h2>{detail.pitch.brandName}</h2>
              {detail.pitch.legalBusinessName && <p className="admin-review-legal-name">{detail.pitch.legalBusinessName}</p>}
              <div className="admin-review-founder-summary">
                <span className="admin-review-avatar" aria-hidden="true">{detail.pitch.founderName.trim().charAt(0).toUpperCase() || 'F'}</span>
                <span><small>SUBMITTED BY</small><strong>{detail.pitch.founderName}</strong><small>{formatDate(detail.pitch.submittedAt)}</small></span>
              </div>
              {detail.pitch.pitchHook && <p className="admin-review-pitch-hook">{detail.pitch.pitchHook}</p>}
              <div className="admin-review-facts">
                <div><span>Capital asked</span><strong>{formatAsk(detail.pitch.originalAskAmount)}</strong></div>
                <div><span>Equity offered</span><strong>{detail.pitch.originalAskEquityPct == null ? 'Not specified' : `${detail.pitch.originalAskEquityPct}%`}</strong></div>
                <div><span>Industry</span><strong>{detail.pitch.industryName || 'Not specified'}</strong></div>
                <div><span>Stage</span><strong>{detail.pitch.stageName || 'Not specified'}</strong></div>
                <div><span>Business model</span><strong>{detail.pitch.businessModel || 'Not specified'}</strong></div>
                <div><span>Location</span><strong>{[detail.pitch.headquartersCity, detail.pitch.headquartersState, detail.pitch.headquartersCountry].filter(Boolean).join(', ') || 'Not specified'}</strong></div>
                <div><span>Founded</span><strong>{detail.pitch.foundedYear ?? 'Not specified'}</strong></div>
                <div><span>Website</span><strong>{detail.pitch.websiteUrl ? <a href={detail.pitch.websiteUrl} target="_blank" rel="noreferrer">Open website ↗</a> : 'Not provided'}</strong></div>
              </div>

              <section className="admin-review-history" aria-labelledby="admin-review-history-title">
                <h3 id="admin-review-history-title">Review history</h3>
                {detail.history.length === 0 ? <p>No decisions recorded yet.</p> : (
                  <ol>
                    {detail.history.map((event) => (
                      <li key={event.reviewEventId}>
                        <div><strong>{event.decision === 'PUBLISH' ? 'Published' : 'Rejected'}</strong><time dateTime={event.decidedAt}>{formatDate(event.decidedAt)}</time></div>
                        <span>Reviewed by {event.reviewerName}</span>
                        {event.reviewNote && <p>{event.reviewNote}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {detail.pitch.pitchStatus === 'SUBMITTED' ? (
                <section className="admin-review-decision" aria-labelledby="admin-review-decision-title">
                  <h3 id="admin-review-decision-title">Record a decision</h3>
                  <label htmlFor="admin-review-note">Review note <span>(required for rejection)</span></label>
                  <textarea
                    id="admin-review-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={2000}
                    rows={4}
                    placeholder="Explain the decision or give the founder actionable feedback…"
                    disabled={Boolean(decisionBusy)}
                  />
                  <div className="admin-review-note-count">{note.trim().length}/2000 characters · rejection requires at least {MIN_REJECTION_NOTE_LENGTH}</div>
                  {decisionError && <p className="admin-review-inline-error" role="alert">{decisionError}</p>}
                  <div className="admin-review-decision-actions">
                    <button type="button" className="admin-review-button danger" disabled={Boolean(decisionBusy)} onClick={() => void handleDecision('REJECT')}>
                      {decisionBusy === 'REJECT' ? 'Rejecting…' : 'Reject with feedback'}
                    </button>
                    <button type="button" className="admin-review-button primary" disabled={Boolean(decisionBusy)} onClick={() => void handleDecision('PUBLISH')}>
                      {decisionBusy === 'PUBLISH' ? 'Publishing…' : 'Publish venture'}
                    </button>
                  </div>
                </section>
              ) : (
                <p className="admin-review-readonly-note">This pitch is no longer awaiting review. Its existing decision is read-only here.</p>
              )}
            </article>
          )}
        </main>
      </div>
    </section>
  );
};

export default AdminReviewPage;
