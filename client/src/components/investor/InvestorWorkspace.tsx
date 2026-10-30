import React, { useState, useEffect, useCallback } from 'react';
import type {
  InvestorDashboardMetrics,
  InvestorPitchItem,
  MetadataCategories,
  InvestorProfileData,
} from '../../types/workspace.ts';
import type { AuthUser } from '../../services/auth.ts';
import {
  fetchInvestorDashboard,
  fetchInvestorPitches,
  toggleInvestorWatchlist,
  sendConnectionRequest,
  fetchInvestorProfile,
  updateInvestorProfile,
  fetchCategories,
} from '../../services/workspace.ts';
import { formatCurrencyINR } from '../../utils/formatters.ts';
import './InvestorWorkspace.css';

export interface InvestorWorkspaceProps {
  currentUser?: AuthUser | null;
  onNavigateToConnections?: () => void;
  onNavigateToDiscovery?: () => void;
  onNavigateToFounder?: () => void;
  onOpenWorkspaces?: () => void;
}

type InvestorSection = 'overview' | 'discover' | 'watchlist' | 'preferences';

export const InvestorWorkspace: React.FC<InvestorWorkspaceProps> = ({
  onNavigateToConnections,
  onNavigateToDiscovery,
}) => {
  // Navigation Section
  const [activeSection, setActiveSection] = useState<InvestorSection>('overview');

  // Metrics & Data
  const [metrics, setMetrics] = useState<InvestorDashboardMetrics | null>(null);
  const [pitches, setPitches] = useState<InvestorPitchItem[]>([]);
  const [watchlistPitches, setWatchlistPitches] = useState<InvestorPitchItem[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState<boolean>(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [categories, setCategories] = useState<MetadataCategories>({ industries: [], stages: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters & Sorting in Discover Tab
  const [search, setSearch] = useState<string>('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('ALL');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<'ALL' | 'SHOW' | 'PLATFORM'>('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'ask_asc' | 'ask_desc' | 'brand_name'>('latest');

  // Detail Modal
  const [detailPitch, setDetailPitch] = useState<InvestorPitchItem | null>(null);

  // Connect Request Modal
  const [connectPitch, setConnectPitch] = useState<InvestorPitchItem | null>(null);
  const [initialMessage, setInitialMessage] = useState<string>('');
  const [connectSubmitting, setConnectSubmitting] = useState<boolean>(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSuccess, setConnectSuccess] = useState<string | null>(null);

  // Investor Profile & Preferences State
  const [profileData, setProfileData] = useState<InvestorProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [profileSaving, setProfileSaving] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Preferences Form Fields
  const [pFirstName, setPFirstName] = useState<string>('');
  const [pLastName, setPLastName] = useState<string>('');
  const [pDisplayName, setPDisplayName] = useState<string>('');
  const [pFirmName, setPFirmName] = useState<string>('');
  const [pBiography, setPBiography] = useState<string>('');
  const [pMinAsk, setPMinAsk] = useState<string>('');
  const [pMaxAsk, setPMaxAsk] = useState<string>('');
  const [pNetWorth, setPNetWorth] = useState<string>('');
  const [pIsAcceptingPitches, setPIsAcceptingPitches] = useState<boolean>(true);
  const [pPrimaryIndustryId, setPPrimaryIndustryId] = useState<number | null>(null);
  const [pCity, setPCity] = useState<string>('');
  const [pState, setPState] = useState<string>('');
  const [pCountry, setPCountry] = useState<string>('India');
  const [pIndustryPrefs, setPIndustryPrefs] = useState<number[]>([]);
  const [pStagePrefs, setPStagePrefs] = useState<number[]>([]);

  // Load Main Discovery Data
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
        }),
      ]);
      setMetrics(dashMetrics);
      setCategories(catData);
      setPitches(pitchList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load investor deal room data.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedIndustry, selectedStage, selectedSource, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Load Dedicated Watchlist Data
  const loadWatchlist = useCallback(async () => {
    setWatchlistLoading(true);
    setWatchlistError(null);
    try {
      const list = await fetchInvestorPitches({ savedOnly: true, sortBy });
      setWatchlistPitches(list);
    } catch (err: unknown) {
      setWatchlistError(err instanceof Error ? err.message : 'Failed to load watchlist pitches.');
    } finally {
      setWatchlistLoading(false);
    }
  }, [sortBy]);

  // Load Preferences / Profile
  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const p = await fetchInvestorProfile();
      setProfileData(p);
      setPFirstName(p.firstName || '');
      setPLastName(p.lastName || '');
      setPDisplayName(p.displayName || '');
      setPFirmName(p.investmentFirmName || '');
      setPBiography(p.biography || '');
      setPMinAsk(p.minInvestmentAmount != null ? String(p.minInvestmentAmount) : '');
      setPMaxAsk(p.maxInvestmentAmount != null ? String(p.maxInvestmentAmount) : '');
      setPNetWorth(p.netWorth != null ? String(p.netWorth) : '');
      setPIsAcceptingPitches(Boolean(p.isAcceptingPitches));
      setPPrimaryIndustryId(p.primaryIndustryId || null);
      setPCity(p.city || '');
      setPState(p.state || '');
      setPCountry(p.country || 'India');
      setPIndustryPrefs(p.industryPreferences || []);
      setPStagePrefs(p.stagePreferences || []);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to load investor profile.');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const handleSelectSection = (section: InvestorSection) => {
    setActiveSection(section);
    if (section === 'watchlist') {
      void loadWatchlist();
    } else if (section === 'preferences' && !profileData && !profileLoading) {
      void loadProfile();
    }
  };

  // Keyboard accessibility for modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (detailPitch) setDetailPitch(null);
        if (connectPitch && !connectSubmitting) setConnectPitch(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [detailPitch, connectPitch, connectSubmitting]);

  // Watchlist Toggle
  const handleToggleWatchlist = async (pitch: InvestorPitchItem) => {
    const res = await toggleInvestorWatchlist(pitch.pitchId);
    if (res.ok) {
      // Update in main pitches list
      setPitches((prev) =>
        prev.map((p) => (p.pitchId === pitch.pitchId ? { ...p, isSaved: res.saved } : p)),
      );

      // Update in detail modal if open
      if (detailPitch && detailPitch.pitchId === pitch.pitchId) {
        setDetailPitch({ ...detailPitch, isSaved: res.saved });
      }

      // Update in dedicated watchlist list
      if (!res.saved) {
        setWatchlistPitches((prev) => prev.filter((p) => p.pitchId !== pitch.pitchId));
      } else {
        // If saved, reload watchlist if in that section
        if (activeSection === 'watchlist') {
          void loadWatchlist();
        }
      }

      // Update metrics counter truthfully
      if (metrics) {
        setMetrics({
          ...metrics,
          savedPitchesCount: res.saved ? metrics.savedPitchesCount + 1 : Math.max(0, metrics.savedPitchesCount - 1),
        });
      }

      setActionSuccess(res.saved ? `"${pitch.brandName}" saved to your private deal room watchlist.` : `"${pitch.brandName}" removed from watchlist.`);
    } else {
      alert(`Could not update watchlist: ${res.message}`);
    }
  };

  // Connect Request Open
  const handleOpenConnect = (pitch: InvestorPitchItem) => {
    setConnectPitch(pitch);
    setInitialMessage(
      `Hello ${pitch.founderName || 'Founder'}, I am reviewing ${pitch.brandName} on Sauda and would like to explore your funding round and strategic partnership terms.`,
    );
    setConnectError(null);
    setConnectSuccess(null);
  };

  // Connect Request Submit
  const handleSubmitConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectPitch) return;

    setConnectSubmitting(true);
    setConnectError(null);

    const res = await sendConnectionRequest(connectPitch.pitchId, initialMessage);
    setConnectSubmitting(false);

    if (res.ok) {
      setConnectSuccess(`Connection request sent to ${connectPitch.founderName || 'Founder'} for ${connectPitch.brandName}!`);
      setPitches((prev) =>
        prev.map((p) =>
          p.pitchId === connectPitch.pitchId
            ? { ...p, connectionStatus: 'PENDING', connectionRequestId: res.request.requestId }
            : p,
        ),
      );
      setWatchlistPitches((prev) =>
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
      }, 1500);
    } else {
      setConnectError(res.message);
    }
  };

  // Preferences Form Save
  const handlePreferencesSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!pFirstName.trim()) {
      setProfileError('First name is required.');
      return;
    }

    let minNum: number | null = null;
    if (pMinAsk.trim()) {
      minNum = Number(pMinAsk);
      if (isNaN(minNum) || minNum < 0) {
        setProfileError('Minimum check size must be a non-negative number.');
        return;
      }
    }

    let maxNum: number | null = null;
    if (pMaxAsk.trim()) {
      maxNum = Number(pMaxAsk);
      if (isNaN(maxNum) || maxNum < 0) {
        setProfileError('Maximum check size must be a non-negative number.');
        return;
      }
    }

    if (minNum !== null && maxNum !== null && minNum > maxNum) {
      setProfileError('Minimum check size cannot exceed maximum check size.');
      return;
    }

    let netWorthNum: number | null = null;
    if (pNetWorth.trim()) {
      netWorthNum = Number(pNetWorth);
      if (isNaN(netWorthNum) || netWorthNum < 0) {
        setProfileError('Net worth must be a non-negative number.');
        return;
      }
    }

    setProfileSaving(true);
    const payload: Partial<InvestorProfileData> = {
      firstName: pFirstName.trim(),
      lastName: pLastName.trim() || null,
      displayName: pDisplayName.trim() || null,
      investmentFirmName: pFirmName.trim() || null,
      biography: pBiography.trim() || null,
      minInvestmentAmount: minNum,
      maxInvestmentAmount: maxNum,
      netWorth: netWorthNum,
      isAcceptingPitches: pIsAcceptingPitches,
      primaryIndustryId: pPrimaryIndustryId || null,
      city: pCity.trim() || null,
      state: pState.trim() || null,
      country: pCountry.trim() || 'India',
      industryPreferences: pIndustryPrefs,
      stagePreferences: pStagePrefs,
    };

    const res = await updateInvestorProfile(payload);
    setProfileSaving(false);

    if (res.ok) {
      setProfileData(res.profile);
      setProfileSuccess('Investment preferences and investor profile saved successfully.');
    } else {
      setProfileError(res.message);
    }
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    selectedIndustry !== 'ALL' ||
    selectedStage !== 'ALL' ||
    selectedSource !== 'ALL';

  const handleClearFilters = () => {
    setSearch('');
    setSelectedIndustry('ALL');
    setSelectedStage('ALL');
    setSelectedSource('ALL');
    setSortBy('latest');
  };

  return (
    <div className="investor-workspace-container">
      {/* Top Utility & Context Bar */}
      <div className="workspace-utility-bar">
        {onNavigateToDiscovery && (
          <button
            type="button"
            className="back-to-discovery-btn"
            onClick={onNavigateToDiscovery}
            aria-label="Return to Startup Discovery"
          >
            <span className="back-arrow" aria-hidden="true">←</span>
            <span>Return to Discovery</span>
          </button>
        )}
      </div>

      {/* Main Header Banner */}
      <header className="investor-header">
        <div className="investor-header-content">
          <div className="investor-crest-label">
            <span className="investor-crest-dot" /> INVESTOR WORKSPACE · DEAL ROOM
          </div>
          <h1 className="investor-title">Deal Flow & Syndication.</h1>
          <p className="investor-subtitle">
            Evaluate platform opportunities, track high-conviction ventures in your private watchlist, and initiate direct connections with founders.
          </p>
        </div>
        <div className="investor-header-actions">
          {onNavigateToConnections && (
            <button type="button" className="investor-conn-btn" onClick={onNavigateToConnections}>
              Active Conversations ({metrics?.activeConnectionsCount || 0}) →
            </button>
          )}
        </div>
      </header>

      {/* Section Sub-Navigation Tabs */}
      <nav className="investor-section-nav" aria-label="Investor Workspace Navigation">
        <button
          type="button"
          className={`section-nav-btn ${activeSection === 'overview' ? 'active' : ''}`}
          onClick={() => handleSelectSection('overview')}
        >
          <span className="nav-icon" aria-hidden="true">📊</span>
          <span>Overview</span>
        </button>

        <button
          type="button"
          className={`section-nav-btn ${activeSection === 'discover' ? 'active' : ''}`}
          onClick={() => handleSelectSection('discover')}
        >
          <span className="nav-icon" aria-hidden="true">🔍</span>
          <span>Discover Deals</span>
          <span className="tab-counter-badge">{metrics?.totalPublishedCount ?? '—'}</span>
        </button>

        <button
          type="button"
          className={`section-nav-btn ${activeSection === 'watchlist' ? 'active' : ''}`}
          onClick={() => handleSelectSection('watchlist')}
        >
          <span className="nav-icon" aria-hidden="true">★</span>
          <span>Saved Pitches</span>
          <span className="tab-counter-badge">{metrics?.savedPitchesCount ?? 0}</span>
        </button>

        <button
          type="button"
          className={`section-nav-btn ${activeSection === 'preferences' ? 'active' : ''}`}
          onClick={() => handleSelectSection('preferences')}
        >
          <span className="nav-icon" aria-hidden="true">💼</span>
          <span>Investment Preferences</span>
        </button>

        {onNavigateToConnections && (
          <button
            type="button"
            className="section-nav-btn shortcut"
            onClick={onNavigateToConnections}
          >
            <span className="nav-icon" aria-hidden="true">💬</span>
            <span>Connections Hub ↗</span>
          </button>
        )}
      </nav>

      {/* Action Feedback Banner */}
      {actionSuccess && (
        <div className="investor-feedback-banner success" role="status">
          <span className="feedback-icon" aria-hidden="true">✓</span>
          <p>{actionSuccess}</p>
          <button type="button" className="banner-dismiss-btn" onClick={() => setActionSuccess(null)} aria-label="Dismiss banner">×</button>
        </div>
      )}

      {/* SECTION 1: OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="investor-overview-section">
          {/* KPI Stats Ribbon */}
          <div className="investor-kpi-ribbon">
            <button
              type="button"
              className="investor-kpi-card"
              onClick={() => {
                setActiveSection('discover');
                setSelectedSource('ALL');
              }}
            >
              <span className="kpi-label">Total Published Deals</span>
              <span className="kpi-number">{metrics ? metrics.totalPublishedCount : '—'}</span>
              <span className="kpi-sub">Verified dual-source registry</span>
            </button>

            <button
              type="button"
              className="investor-kpi-card"
              onClick={() => {
                setActiveSection('discover');
                setSelectedSource('PLATFORM');
              }}
            >
              <span className="kpi-label">Platform Listings</span>
              <span className="kpi-number gold">{metrics ? metrics.publishedPlatformCount : '—'}</span>
              <span className="kpi-sub">Direct founder connect eligible</span>
            </button>

            <button
              type="button"
              className="investor-kpi-card"
              onClick={() => {
                setActiveSection('discover');
                setSelectedSource('SHOW');
              }}
            >
              <span className="kpi-label">Show Broadcasts</span>
              <span className="kpi-number blue">{metrics ? metrics.publishedShowCount : '—'}</span>
              <span className="kpi-sub">Shark Tank historical records</span>
            </button>

            <button
              type="button"
              className="investor-kpi-card"
              onClick={() => handleSelectSection('watchlist')}
            >
              <span className="kpi-label">Saved to Watchlist</span>
              <span className="kpi-number teal">{metrics ? metrics.savedPitchesCount : '—'}</span>
              <span className="kpi-sub">High-conviction bookmarked deals</span>
            </button>
          </div>

          {/* Workflow Shortcuts Grid */}
          <div className="investor-shortcuts-grid">
            <div className="shortcut-card">
              <div className="shortcut-icon" aria-hidden="true">🔍</div>
              <h3>Explore Deal Flow</h3>
              <p>Filter published pitches by industry sector, development stage, valuation terms, and source.</p>
              <button type="button" className="shortcut-cta-btn" onClick={() => handleSelectSection('discover')}>
                Open Deal Catalog →
              </button>
            </div>

            <div className="shortcut-card">
              <div className="shortcut-icon" aria-hidden="true">★</div>
              <h3>Private Watchlist</h3>
              <p>Review and monitor bookmarked ventures, analyze funding asks, and prepare syndication checks.</p>
              <button type="button" className="shortcut-cta-btn" onClick={() => handleSelectSection('watchlist')}>
                Open Watchlist ({metrics?.savedPitchesCount || 0}) →
              </button>
            </div>

            <div className="shortcut-card">
              <div className="shortcut-icon" aria-hidden="true">💼</div>
              <h3>Thesis & Preferences</h3>
              <p>Configure check size bounds, thesis narrative, and primary industry sectors for inbound deal flow.</p>
              <button type="button" className="shortcut-cta-btn" onClick={() => handleSelectSection('preferences')}>
                Update Thesis →
              </button>
            </div>

            {onNavigateToConnections && (
              <div className="shortcut-card">
                <div className="shortcut-icon" aria-hidden="true">💬</div>
                <h3>Active Inquiries & Chats</h3>
                <p>Track sent introduction requests and exchange messages with connected founders in real time.</p>
                <button type="button" className="shortcut-cta-btn" onClick={onNavigateToConnections}>
                  Open Connections ({metrics?.activeConnectionsCount || 0}) →
                </button>
              </div>
            )}
          </div>

          {/* Dual-Source Deal Registry Breakdown */}
          <div className="investor-source-breakdown">
            <div className="breakdown-card">
              <div className="source-badge-tag platform">PLATFORM DIRECT</div>
              <h4>Direct Venture Proposals ({metrics?.publishedPlatformCount || 0})</h4>
              <p>
                Platform listings are submitted directly by registered founders and approved through administrative moderation. These ventures are active rounds where you can request direct introductions and private discussions.
              </p>
              <button
                type="button"
                className="source-browse-btn"
                onClick={() => {
                  setActiveSection('discover');
                  setSelectedSource('PLATFORM');
                }}
              >
                Browse Platform Deals →
              </button>
            </div>

            <div className="breakdown-card">
              <div className="source-badge-tag show">SHARK TANK TELEVISION</div>
              <h4>Televised Pitches Archive ({metrics?.publishedShowCount || 0})</h4>
              <p>
                Televised records represent historical Shark Tank broadcasts. These reference records allow you to compare valuations, equity dilution metrics, and industry distributions against platform ventures.
              </p>
              <button
                type="button"
                className="source-browse-btn"
                onClick={() => {
                  setActiveSection('discover');
                  setSelectedSource('SHOW');
                }}
              >
                Browse Show Records →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: DISCOVER DEALS */}
      {activeSection === 'discover' && (
        <div className="investor-discover-section">
          {/* Controls Bar */}
          <div className="investor-controls-bar">
            <div className="search-box">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                type="text"
                placeholder="Search venture name, business model, or thesis keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search deals"
              />
              {search && (
                <button type="button" className="clear-search-btn" onClick={() => setSearch('')} aria-label="Clear search">
                  ✕
                </button>
              )}
            </div>

            <div className="filters-group">
              <select
                value={selectedIndustry}
                onChange={(e) => setSelectedIndustry(e.target.value)}
                aria-label="Filter by industry"
              >
                <option value="ALL">All Industries</option>
                {categories.industries.map((ind) => (
                  <option key={ind.industryId} value={ind.industryName}>
                    {ind.industryName}
                  </option>
                ))}
              </select>

              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                aria-label="Filter by stage"
              >
                <option value="ALL">All Stages</option>
                {categories.stages.map((stg) => (
                  <option key={stg.stageId} value={stg.stageName}>
                    {stg.stageName}
                  </option>
                ))}
              </select>

              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value as 'ALL' | 'SHOW' | 'PLATFORM')}
                aria-label="Filter by source"
              >
                <option value="ALL">All Sources</option>
                <option value="PLATFORM">Platform Direct</option>
                <option value="SHOW">Shark Tank Show</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'latest' | 'ask_asc' | 'ask_desc' | 'brand_name')}
                aria-label="Sort pitches"
              >
                <option value="latest">Sort: Latest Published</option>
                <option value="ask_desc">Sort: Ask (High to Low)</option>
                <option value="ask_asc">Sort: Ask (Low to High)</option>
                <option value="brand_name">Sort: Brand Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="active-filters-chips-row">
              <span className="chips-label">Active Filters:</span>
              {search.trim() && (
                <span className="filter-chip">
                  Search: &ldquo;{search.trim()}&rdquo;
                  <button type="button" onClick={() => setSearch('')} aria-label="Clear search filter">×</button>
                </span>
              )}
              {selectedIndustry !== 'ALL' && (
                <span className="filter-chip">
                  Sector: {selectedIndustry}
                  <button type="button" onClick={() => setSelectedIndustry('ALL')} aria-label="Clear industry filter">×</button>
                </span>
              )}
              {selectedStage !== 'ALL' && (
                <span className="filter-chip">
                  Stage: {selectedStage}
                  <button type="button" onClick={() => setSelectedStage('ALL')} aria-label="Clear stage filter">×</button>
                </span>
              )}
              {selectedSource !== 'ALL' && (
                <span className="filter-chip">
                  Source: {selectedSource === 'PLATFORM' ? 'Platform Direct' : 'Shark Tank Show'}
                  <button type="button" onClick={() => setSelectedSource('ALL')} aria-label="Clear source filter">×</button>
                </span>
              )}
              <button type="button" className="reset-filters-btn" onClick={handleClearFilters}>
                Reset All Filters
              </button>
            </div>
          )}

          {/* Deal Flow Grid */}
          {loading ? (
            <div className="investor-loading-stage">
              <div className="investor-spinner" />
              <p>Scanning venture registry for matching deals...</p>
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
              <div className="empty-icon" aria-hidden="true">📊</div>
              <h3>No ventures match your filter criteria.</h3>
              <p>Try broadening your query, adjusting sector preferences, or resetting filters.</p>
              <button type="button" className="investor-reset-btn" onClick={handleClearFilters}>
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
        </div>
      )}

      {/* SECTION 3: DEDICATED WATCHLIST */}
      {activeSection === 'watchlist' && (
        <div className="investor-watchlist-section">
          <div className="section-intro">
            <h2>Dedicated Watchlist · Saved Ventures</h2>
            <p>
              Your high-conviction deal pipeline. Review bookmarked opportunities, track diligence priorities, and initiate syndication discussions.
            </p>
          </div>

          {watchlistLoading ? (
            <div className="investor-loading-stage">
              <div className="investor-spinner" />
              <p>Loading your private watchlist...</p>
            </div>
          ) : watchlistError ? (
            <div className="investor-error-stage">
              <p className="error-text">⚠️ {watchlistError}</p>
              <button type="button" className="investor-retry-btn" onClick={loadWatchlist}>
                Retry Connection
              </button>
            </div>
          ) : watchlistPitches.length === 0 ? (
            <div className="investor-empty-stage">
              <div className="empty-icon" aria-hidden="true">★</div>
              <h3>Your deal room watchlist is empty.</h3>
              <p>
                Explore published ventures in the discovery tab and click the bookmark star to save pitches for closer inspection.
              </p>
              <button
                type="button"
                className="investor-primary-btn"
                onClick={() => handleSelectSection('discover')}
              >
                Browse Published Deals →
              </button>
            </div>
          ) : (
            <div className="investor-deals-grid">
              {watchlistPitches.map((pitch) => (
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
                        className="deal-bookmark-btn saved"
                        onClick={() => handleToggleWatchlist(pitch)}
                        title="Remove from watchlist"
                        aria-label="Remove from watchlist"
                      >
                        ★
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
        </div>
      )}

      {/* SECTION 4: INVESTMENT PREFERENCES & PROFILE */}
      {activeSection === 'preferences' && (
        <div className="investor-preferences-section">
          <div className="section-intro">
            <h2>Investment Thesis & Syndicate Preferences</h2>
            <p>
              Specify your investment firm credentials, target check sizes, and focus industries. These preferences guide founder connection proposals.
            </p>
          </div>

          {profileSuccess && (
            <div className="investor-feedback-banner success" role="status">
              <span className="feedback-icon" aria-hidden="true">✓</span>
              <p>{profileSuccess}</p>
            </div>
          )}

          {profileError && (
            <div className="investor-feedback-banner error" role="alert">
              <span className="feedback-icon" aria-hidden="true">⚠</span>
              <p>{profileError}</p>
            </div>
          )}

          {profileLoading ? (
            <div className="investor-loading-stage">
              <div className="investor-spinner" />
              <p>Loading investor profile...</p>
            </div>
          ) : (
            <form onSubmit={handlePreferencesSave} className="investor-preferences-form">
              <div className="form-grid-two">
                <div className="form-field">
                  <label htmlFor="inv-first-name">First Name *</label>
                  <input
                    id="inv-first-name"
                    type="text"
                    required
                    maxLength={80}
                    value={pFirstName}
                    onChange={(e) => setPFirstName(e.target.value)}
                    disabled={profileSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="inv-last-name">Last Name</label>
                  <input
                    id="inv-last-name"
                    type="text"
                    maxLength={80}
                    value={pLastName}
                    onChange={(e) => setPLastName(e.target.value)}
                    disabled={profileSaving}
                  />
                </div>
              </div>

              <div className="form-grid-two">
                <div className="form-field">
                  <label htmlFor="inv-display-name">Public Display Name</label>
                  <input
                    id="inv-display-name"
                    type="text"
                    maxLength={150}
                    placeholder="e.g. Vikram Sharma, Angel Investor"
                    value={pDisplayName}
                    onChange={(e) => setPDisplayName(e.target.value)}
                    disabled={profileSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="inv-firm-name">Investment Firm / Syndicate Name</label>
                  <input
                    id="inv-firm-name"
                    type="text"
                    maxLength={180}
                    placeholder="e.g. Apex Ventures, Blue Ridge Capital"
                    value={pFirmName}
                    onChange={(e) => setPFirmName(e.target.value)}
                    disabled={profileSaving}
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="inv-bio">Investment Thesis & Background</label>
                <textarea
                  id="inv-bio"
                  rows={4}
                  maxLength={5000}
                  placeholder="Outline your investment thesis, value-add networks, target stage focus, and portfolio support approach..."
                  value={pBiography}
                  onChange={(e) => setPBiography(e.target.value)}
                  disabled={profileSaving}
                />
              </div>

              <div className="form-grid-three">
                <div className="form-field">
                  <label htmlFor="inv-min-check">Min Check Size (₹ INR)</label>
                  <input
                    id="inv-min-check"
                    type="number"
                    min="0"
                    step="50000"
                    placeholder="e.g. 500000"
                    value={pMinAsk}
                    onChange={(e) => setPMinAsk(e.target.value)}
                    disabled={profileSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="inv-max-check">Max Check Size (₹ INR)</label>
                  <input
                    id="inv-max-check"
                    type="number"
                    min="0"
                    step="50000"
                    placeholder="e.g. 5000000"
                    value={pMaxAsk}
                    onChange={(e) => setPMaxAsk(e.target.value)}
                    disabled={profileSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="inv-net-worth">Estimated Net Worth (₹ INR)</label>
                  <input
                    id="inv-net-worth"
                    type="number"
                    min="0"
                    step="100000"
                    placeholder="e.g. 20000000"
                    value={pNetWorth}
                    onChange={(e) => setPNetWorth(e.target.value)}
                    disabled={profileSaving}
                  />
                </div>
              </div>

              <div className="form-grid-two">
                <div className="form-field">
                  <label htmlFor="inv-primary-ind">Primary Focus Industry</label>
                  <select
                    id="inv-primary-ind"
                    value={pPrimaryIndustryId ?? ''}
                    onChange={(e) => setPPrimaryIndustryId(e.target.value ? Number(e.target.value) : null)}
                    disabled={profileSaving}
                  >
                    <option value="">Select Primary Industry (Optional)</option>
                    {categories.industries.map((ind) => (
                      <option key={ind.industryId} value={ind.industryId}>
                        {ind.industryName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field checkbox-field">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={pIsAcceptingPitches}
                      onChange={(e) => setPIsAcceptingPitches(e.target.checked)}
                      disabled={profileSaving}
                    />
                    <span className="checkbox-label">Currently accepting founder pitch proposals</span>
                  </label>
                </div>
              </div>

              <div className="form-grid-three">
                <div className="form-field">
                  <label htmlFor="inv-city">City</label>
                  <input
                    id="inv-city"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Bengaluru"
                    value={pCity}
                    onChange={(e) => setPCity(e.target.value)}
                    disabled={profileSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="inv-state">State</label>
                  <input
                    id="inv-state"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Karnataka"
                    value={pState}
                    onChange={(e) => setPState(e.target.value)}
                    disabled={profileSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="inv-country">Country</label>
                  <input
                    id="inv-country"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. India"
                    value={pCountry}
                    onChange={(e) => setPCountry(e.target.value)}
                    disabled={profileSaving}
                  />
                </div>
              </div>

              {/* Multi-Select Industry Preferences */}
              <div className="preferences-pills-section">
                <label className="pills-title">Industry Sector Preferences</label>
                <p className="pills-sub">Select sectors you actively syndicate or mentor:</p>
                <div className="pills-grid">
                  {categories.industries.map((ind) => {
                    const isSelected = pIndustryPrefs.includes(ind.industryId);
                    return (
                      <button
                        key={ind.industryId}
                        type="button"
                        className={`pref-pill-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setPIndustryPrefs((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== ind.industryId)
                              : [...prev, ind.industryId],
                          );
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {ind.industryName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Select Stage Preferences */}
              <div className="preferences-pills-section">
                <label className="pills-title">Startup Stage Preferences</label>
                <p className="pills-sub">Select preferred development stages:</p>
                <div className="pills-grid">
                  {categories.stages.map((stg) => {
                    const isSelected = pStagePrefs.includes(stg.stageId);
                    return (
                      <button
                        key={stg.stageId}
                        type="button"
                        className={`pref-pill-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setPStagePrefs((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== stg.stageId)
                              : [...prev, stg.stageId],
                          );
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {stg.stageName}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="preferences-form-actions">
                <button
                  type="submit"
                  className="investor-primary-btn"
                  disabled={profileSaving}
                >
                  {profileSaving ? 'Saving Preferences...' : 'Save Investment Preferences'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Pitch Detail Modal */}
      {detailPitch && (
        <div className="investor-modal-overlay" onClick={() => setDetailPitch(null)}>
          <div className="investor-modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="detail-pitch-title">
            <div className="investor-modal-header">
              <div>
                <span className="modal-sub-label">{detailPitch.pitchType} LISTING RECORD</span>
                <h2 id="detail-pitch-title">{detailPitch.brandName}</h2>
                {detailPitch.legalBusinessName && (
                  <p className="modal-legal">{detailPitch.legalBusinessName}</p>
                )}
              </div>
              <button
                type="button"
                className="investor-modal-close"
                onClick={() => setDetailPitch(null)}
                aria-label="Close modal"
              >
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
                  <div className="founder-avatar" aria-hidden="true">👤</div>
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
          <div className="connect-modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="connect-modal-title">
            <div className="connect-modal-header">
              <h2 id="connect-modal-title">Initiate Introduction Request</h2>
              <button
                type="button"
                className="investor-modal-close"
                disabled={connectSubmitting}
                onClick={() => setConnectPitch(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <p className="connect-modal-desc">
              Send a connection proposal to <strong>{connectPitch.founderName || 'Founder'}</strong> for{' '}
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