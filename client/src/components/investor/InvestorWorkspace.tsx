import React, { useState, useEffect, useCallback } from 'react';
import type {
  InvestorDashboardMetrics,
  InvestorPitchItem,
  MetadataCategories,
} from '../../types/workspace.ts';
import {
  fetchInvestorDashboard,
  fetchInvestorPitches,
  toggleInvestorWatchlist,
  sendConnectionRequest,
  fetchCategories,
} from '../../services/workspace.ts';
import { formatCurrencyINR } from '../../utils/formatters.ts';
import './InvestorWorkspace.css';

export interface InvestorWorkspaceProps {
  onNavigateToConnections?: () => void;
  onNavigateToDiscovery?: () => void;
}

export const InvestorWorkspace: React.FC<InvestorWorkspaceProps> = ({
  onNavigateToConnections,
  onNavigateToDiscovery,
}) => {
  const [metrics, setMetrics] = useState<InvestorDashboardMetrics | null>(null);
  const [pitches, setPitches] = useState<InvestorPitchItem[]>([]);
  const [categories, setCategories] = useState<MetadataCategories>({ industries: [], stages: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting
  const [search, setSearch] = useState<string>('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('ALL');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<'ALL' | 'SHOW' | 'PLATFORM'>('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'ask_asc' | 'ask_desc' | 'brand_name'>('latest');
  const [savedOnly, setSavedOnly] = useState<boolean>(false);

  // Detail Modal
  const [detailPitch, setDetailPitch] = useState<InvestorPitchItem | null>(null);

  // Connect Request Modal
  const [connectPitch, setConnectPitch] = useState<InvestorPitchItem | null>(null);
  const [initialMessage, setInitialMessage] = useState<string>('');
  const [connectSubmitting, setConnectSubmitting] = useState<boolean>(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSuccess, setConnectSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashMetrics, catData, pitchList] = await Promise.all([
        fetchInvestorDashboard(),
        fetchCategories(),
        fetchInvestorPitches({
          search: search.trim() || undefined,
          industry: selectedIndustry !== 'ALL' ? selectedIndustry : undefined,
          stage: selectedStage !== 'ALL' ? selectedStage : undefined,
          source: selectedSource,
          sortBy,
          savedOnly,
        }),
      ]);
      setMetrics(dashMetrics);
      setCategories(catData);
      setPitches(pitchList);
    } catch (err: any) {
      setError(err.message || 'Failed to load investor deal room data.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedIndustry, selectedStage, selectedSource, sortBy, savedOnly]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleToggleWatchlist = async (pitch: InvestorPitchItem) => {
    const res = await toggleInvestorWatchlist(pitch.pitchId);
    if (res.ok) {
      setPitches((prev) =>
        prev.map((p) => (p.pitchId === pitch.pitchId ? { ...p, isSaved: res.saved } : p)),
      );
      if (metrics) {
        setMetrics({
          ...metrics,
          savedPitchesCount: res.saved ? metrics.savedPitchesCount + 1 : Math.max(0, metrics.savedPitchesCount - 1),
        });
      }
    }
  };

  const handleOpenConnect = (pitch: InvestorPitchItem) => {
    setConnectPitch(pitch);
    setInitialMessage(
      `Hello ${pitch.founderName || 'Founder'}, I am reviewing ${pitch.brandName} on Sauda and would like to explore your current funding round and syndicate terms.`,
    );
    setConnectError(null);
    setConnectSuccess(null);
  };

  const handleSubmitConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectPitch) return;

    setConnectSubmitting(true);
    setConnectError(null);

    const res = await sendConnectionRequest(connectPitch.pitchId, initialMessage);
    setConnectSubmitting(false);

    if (res.ok) {
      setConnectSuccess(`Connection request sent to ${connectPitch.founderName || 'Founder'} for ${connectPitch.brandName}!`);
      // Update pitch status locally
      setPitches((prev) =>
        prev.map((p) =>
          p.pitchId === connectPitch.pitchId
            ? { ...p, connectionStatus: 'PENDING', connectionRequestId: res.request.requestId }
            : p,
        ),
      );
      if (metrics) {
        setMetrics({
          ...metrics,
          sentRequestsCount: metrics.sentRequestsCount + 1,
        });
      }
      setTimeout(() => {
        setConnectPitch(null);
      }, 1400);
    } else {
      setConnectError(res.message);
    }
  };

  return (
    <div className="investor-workspace-container">
      {onNavigateToDiscovery && (
        <div className="workspace-return-nav" style={{ marginBottom: '16px' }}>
          <button
            type="button"
            className="back-to-discovery-btn"
            onClick={onNavigateToDiscovery}
            aria-label="Return to Startup Discovery"
          >
            <span className="back-arrow" aria-hidden="true">←</span>
            <span>Back to Startup Discovery</span>
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="investor-header">
        <div className="investor-header-content">
          <div className="investor-crest-label">
            <span className="investor-crest-dot" /> INVESTOR WORKSPACE · DEAL FLOW
          </div>
          <h1 className="investor-title">Your Deal Room.</h1>
          <p className="investor-subtitle">
            Discover published ventures, compare funding asks, build your watchlist, and connect with founders.
          </p>
        </div>
        <div className="investor-header-actions">
          {onNavigateToConnections && (
            <button type="button" className="investor-conn-btn" onClick={onNavigateToConnections}>
              Active Conversations ({metrics?.activeConnectionsCount || 0}) →
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="investor-kpi-ribbon">
        <button type="button" className={`investor-kpi-card ${selectedSource === 'ALL' && !savedOnly ? 'selected' : ''}`} aria-pressed={selectedSource === 'ALL' && !savedOnly} onClick={() => { setSelectedSource('ALL'); setSavedOnly(false); }}>
          <span className="kpi-label">Total Published Deals</span>
          <span className="kpi-number">{metrics ? metrics.totalPublishedCount : '—'}</span>
          <span className="kpi-sub">Dual-source deal registry</span>
        </button>
        <button type="button" className={`investor-kpi-card ${selectedSource === 'PLATFORM' && !savedOnly ? 'selected' : ''}`} aria-pressed={selectedSource === 'PLATFORM' && !savedOnly} onClick={() => { setSelectedSource('PLATFORM'); setSavedOnly(false); }}>
          <span className="kpi-label">Platform Direct Listings</span>
          <span className="kpi-number gold">{metrics ? metrics.publishedPlatformCount : '—'}</span>
          <span className="kpi-sub">Direct founder connect eligible</span>
        </button>
        <button type="button" className={`investor-kpi-card ${selectedSource === 'SHOW' && !savedOnly ? 'selected' : ''}`} aria-pressed={selectedSource === 'SHOW' && !savedOnly} onClick={() => { setSelectedSource('SHOW'); setSavedOnly(false); }}>
          <span className="kpi-label">Television Pitches</span>
          <span className="kpi-number blue">{metrics ? metrics.publishedShowCount : '—'}</span>
          <span className="kpi-sub">Broadcasted show history</span>
        </button>
        <button type="button" className={`investor-kpi-card ${savedOnly ? 'selected' : ''}`} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>
          <span className="kpi-label">Saved to Watchlist</span>
          <span className="kpi-number teal">{metrics ? metrics.savedPitchesCount : '—'}</span>
          <span className="kpi-sub">Bookmarked ventures</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="investor-controls-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by venture name, business model, or thesis keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="clear-search-btn" onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>

        <div className="filters-group">
          <select value={selectedIndustry} onChange={(e) => setSelectedIndustry(e.target.value)}>
            <option value="ALL">All Industries</option>
            {categories.industries.map((ind) => (
              <option key={ind.industryId} value={ind.industryName}>
                {ind.industryName}
              </option>
            ))}
          </select>

          <select value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)}>
            <option value="ALL">All Stages</option>
            {categories.stages.map((stg) => (
              <option key={stg.stageId} value={stg.stageName}>
                {stg.stageName}
              </option>
            ))}
          </select>

          <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value as any)}>
            <option value="ALL">All Sources</option>
            <option value="PLATFORM">Platform Direct</option>
            <option value="SHOW">Shark Tank Show</option>
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="latest">Sort: Latest Published</option>
            <option value="ask_desc">Sort: Ask (High to Low)</option>
            <option value="ask_asc">Sort: Ask (Low to High)</option>
            <option value="brand_name">Sort: Brand Name (A-Z)</option>
          </select>

          <button
            type="button"
            className={`watchlist-filter-btn ${savedOnly ? 'active' : ''}`}
            onClick={() => setSavedOnly(!savedOnly)}
          >
            ★ {savedOnly ? 'Viewing Watchlist' : 'Watchlist Only'}
          </button>
        </div>
      </div>

      {/* Main Content Deal Flow Grid */}
      {loading ? (
        <div className="investor-loading-stage">
          <div className="investor-spinner" />
          <p>Filtering published investment flow...</p>
        </div>
      ) : error ? (
        <div className="investor-error-stage">
          <p className="error-text">⚠️ {error}</p>
          <button type="button" className="investor-retry-btn" onClick={loadData}>
            Retry Connection
          </button>
        </div>
      ) : pitches.length === 0 ? (
        <div className="investor-empty-stage">
          <div className="empty-icon">📊</div>
          <h3>No ventures match your criteria.</h3>
          <p>Try resetting filters or expanding your search terms.</p>
          <button
            type="button"
            className="investor-reset-btn"
            onClick={() => {
              setSearch('');
              setSelectedIndustry('ALL');
              setSelectedStage('ALL');
              setSelectedSource('ALL');
              setSavedOnly(false);
            }}
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="investor-deals-grid">
          {pitches.map((pitch) => (
            <div key={pitch.pitchId} className="investor-deal-card">
              <div className="deal-card-header">
                <div className="deal-brand-block">
                  <h3 className="deal-brand-name">{pitch.brandName}</h3>
                  {pitch.legalBusinessName && (
                    <span className="deal-legal-name">{pitch.legalBusinessName}</span>
                  )}
                </div>
                <div className="deal-actions-right">
                  <button
                    type="button"
                    className={`deal-bookmark-btn ${pitch.isSaved ? 'saved' : ''}`}
                    onClick={() => handleToggleWatchlist(pitch)}
                    title={pitch.isSaved ? 'Remove from watchlist' : 'Save to watchlist'}
                    aria-label={pitch.isSaved ? 'Remove from watchlist' : 'Save to watchlist'}
                  >
                    {pitch.isSaved ? '★' : '☆'}
                  </button>
                  <span className={`deal-source-badge ${pitch.pitchType.toLowerCase()}`}>
                    {pitch.pitchType === 'PLATFORM' ? 'Platform' : 'Shark Tank'}
                  </span>
                </div>
              </div>

              {pitch.pitchHook && <p className="deal-hook">{pitch.pitchHook}</p>}

              <div className="deal-tags-row">
                {pitch.industry && <span className="deal-tag">{pitch.industry}</span>}
                {pitch.startupStage && <span className="deal-tag stage">{pitch.startupStage}</span>}
                {pitch.businessModel && <span className="deal-tag model">{pitch.businessModel}</span>}
                {pitch.headquartersCity && (
                  <span className="deal-tag location">
                    📍 {pitch.headquartersCity}
                    {pitch.headquartersState ? `, ${pitch.headquartersState}` : ''}
                  </span>
                )}
              </div>

              <div className="deal-terms-panel">
                <div className="term-item">
                  <span className="term-label">Target Funding Ask</span>
                  <span className="term-val">
                    {pitch.originalAskAmount ? formatCurrencyINR(Number(pitch.originalAskAmount)) : 'Undisclosed'}
                  </span>
                </div>
                <div className="term-item">
                  <span className="term-label">Equity Offered</span>
                  <span className="term-val">
                    {pitch.originalAskEquityPct ? `${pitch.originalAskEquityPct}%` : 'Undisclosed'}
                  </span>
                </div>
              </div>

              <div className="deal-card-footer">
                <button
                  type="button"
                  className="deal-detail-btn"
                  onClick={() => setDetailPitch(pitch)}
                >
                  View Details
                </button>

                {pitch.pitchType === 'PLATFORM' ? (
                  pitch.connectionStatus === 'ACCEPTED' ? (
                    <span className="deal-conn-status connected">✓ Connected</span>
                  ) : pitch.connectionStatus === 'PENDING' ? (
                    <span className="deal-conn-status pending">⏳ Request Pending</span>
                  ) : (
                    <button
                      type="button"
                      className="deal-connect-btn"
                      onClick={() => handleOpenConnect(pitch)}
                    >
                      Request Intro →
                    </button>
                  )
                ) : (
                  <span className="deal-conn-status tv-record">TV Broadcast Record</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pitch Detail Modal */}
      {detailPitch && (
        <div className="investor-modal-overlay" onClick={() => setDetailPitch(null)}>
          <div className="investor-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="investor-modal-header">
              <div>
                <span className="modal-sub-label">{detailPitch.pitchType} LISTING RECORD</span>
                <h2>{detailPitch.brandName}</h2>
                {detailPitch.legalBusinessName && (
                  <p className="modal-legal">{detailPitch.legalBusinessName}</p>
                )}
              </div>
              <button type="button" className="investor-modal-close" onClick={() => setDetailPitch(null)}>
                ✕
              </button>
            </div>

            <div className="investor-modal-body">
              {detailPitch.pitchHook && (
                <div className="detail-section">
                  <h4>Venture Thesis / Summary</h4>
                  <p className="detail-hook-text">{detailPitch.pitchHook}</p>
                </div>
              )}

              <div className="detail-grid">
                <div className="detail-cell">
                  <span className="cell-lbl">Industry Category</span>
                  <span className="cell-val">{detailPitch.industry || 'General'}</span>
                </div>
                <div className="detail-cell">
                  <span className="cell-lbl">Funding Stage</span>
                  <span className="cell-val">{detailPitch.startupStage || 'Unspecified'}</span>
                </div>
                <div className="detail-cell">
                  <span className="cell-lbl">Target Ask</span>
                  <span className="cell-val">
                    {detailPitch.originalAskAmount ? formatCurrencyINR(Number(detailPitch.originalAskAmount)) : 'Undisclosed'}
                  </span>
                </div>
                <div className="detail-cell">
                  <span className="cell-lbl">Equity Dilution</span>
                  <span className="cell-val">
                    {detailPitch.originalAskEquityPct ? `${detailPitch.originalAskEquityPct}%` : 'Undisclosed'}
                  </span>
                </div>
                <div className="detail-cell">
                  <span className="cell-lbl">Business Model</span>
                  <span className="cell-val">{detailPitch.businessModel || 'Direct'}</span>
                </div>
                <div className="detail-cell">
                  <span className="cell-lbl">Headquarters</span>
                  <span className="cell-val">
                    {detailPitch.headquartersCity
                      ? `${detailPitch.headquartersCity}, ${detailPitch.headquartersState || ''}`
                      : 'India'}
                  </span>
                </div>
                {detailPitch.foundedYear && (
                  <div className="detail-cell">
                    <span className="cell-lbl">Founded Year</span>
                    <span className="cell-val">{detailPitch.foundedYear}</span>
                  </div>
                )}
                {detailPitch.websiteUrl && (
                  <div className="detail-cell">
                    <span className="cell-lbl">Website</span>
                    <span className="cell-val">
                      <a href={detailPitch.websiteUrl} target="_blank" rel="noopener noreferrer">
                        {detailPitch.websiteUrl}
                      </a>
                    </span>
                  </div>
                )}
              </div>

              {detailPitch.pitchType === 'PLATFORM' && detailPitch.founderName && (
                <div className="detail-founder-strip">
                  <div className="founder-avatar">👤</div>
                  <div>
                    <span className="founder-lbl">Registered Founder</span>
                    <span className="founder-name">{detailPitch.founderName}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="investor-modal-footer">
              <button
                type="button"
                className={`modal-bookmark-btn ${detailPitch.isSaved ? 'saved' : ''}`}
                onClick={() => handleToggleWatchlist(detailPitch)}
              >
                {detailPitch.isSaved ? '★ Bookmarked in Watchlist' : '☆ Add to Watchlist'}
              </button>

              {detailPitch.pitchType === 'PLATFORM' && (
                detailPitch.connectionStatus === 'ACCEPTED' ? (
                  <span className="modal-conn-pill connected">✓ Active Connection</span>
                ) : detailPitch.connectionStatus === 'PENDING' ? (
                  <span className="modal-conn-pill pending">⏳ Request Pending</span>
                ) : (
                  <button
                    type="button"
                    className="modal-connect-btn"
                    onClick={() => {
                      setDetailPitch(null);
                      handleOpenConnect(detailPitch);
                    }}
                  >
                    Request Introduction →
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connect Request Modal */}
      {connectPitch && (
        <div className="investor-modal-overlay" onClick={() => !connectSubmitting && setConnectPitch(null)}>
          <div className="connect-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="connect-modal-header">
              <h2>Initiate Introduction Request</h2>
              <button
                type="button"
                className="investor-modal-close"
                disabled={connectSubmitting}
                onClick={() => setConnectPitch(null)}
              >
                ✕
              </button>
            </div>

            <p className="connect-modal-desc">
              Send a verified connection proposal to <strong>{connectPitch.founderName || 'Founder'}</strong> for{' '}
              <strong>{connectPitch.brandName}</strong>. If accepted, a private conversation thread will be opened.
            </p>

            {connectError && (
              <div className="connect-error-banner" role="alert">
                ⚠️ {connectError}
              </div>
            )}

            {connectSuccess && (
              <div className="connect-success-banner" role="status">
                ✓ {connectSuccess}
              </div>
            )}

            {!connectSuccess && (
              <form onSubmit={handleSubmitConnect} className="connect-form">
                <div className="form-field">
                  <label htmlFor="connect-msg">Initial Introduction / Investment Thesis *</label>
                  <textarea
                    id="connect-msg"
                    rows={4}
                    required
                    maxLength={1000}
                    placeholder="Describe your fund or angel thesis, ticket size capability, and strategic value add..."
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    disabled={connectSubmitting}
                  />
                </div>

                <div className="connect-modal-actions">
                  <button
                    type="button"
                    className="connect-btn-cancel"
                    disabled={connectSubmitting}
                    onClick={() => setConnectPitch(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="connect-btn-send"
                    disabled={connectSubmitting}
                  >
                    {connectSubmitting ? 'Sending Request...' : 'Send Introduction Request →'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
