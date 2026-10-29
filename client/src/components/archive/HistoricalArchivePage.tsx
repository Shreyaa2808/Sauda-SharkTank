import React, { useEffect, useState } from 'react';
import type { Startup } from '../../types/startup.ts';
import type {
  HistoricalEpisode,
  HistoricalEpisodeDetail,
  HistoricalPitchFilters,
  HistoricalPitchRow,
  HistoricalSeason,
  HistoricalShark,
  HistoricalStatistics,
} from '../../types/historical.ts';
import {
  fetchHistoricalEpisodeDetail,
  fetchHistoricalEpisodes,
  fetchHistoricalPitches,
  fetchHistoricalSeasons,
  fetchHistoricalSharks,
  fetchHistoricalStatistics,
  historicalPitchRowToStartup,
} from '../../services/historical.ts';
import {
  formatCurrency,
  formatEquity,
  formatPitchNumber,
} from '../../utils/formatters.ts';
import './HistoricalArchivePage.css';

export interface HistoricalArchivePageProps {
  onNavigateToDiscovery: () => void;
  onSelectStartup: (startup: Startup) => void;
  onToggleCompare: (startup: Startup) => void;
  selectedForCompare: Startup[];
  initialTab?: 'seasons' | 'pitches' | 'sharks' | 'statistics';
  initialSharkId?: number;
}

type ArchiveTab = 'seasons' | 'pitches' | 'sharks' | 'statistics';

function formatDateSafe(val: string | null | undefined): string {
  if (!val) return 'Date not recorded';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val).split('T')[0];
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const HistoricalArchivePage: React.FC<HistoricalArchivePageProps> = ({
  onNavigateToDiscovery,
  onSelectStartup,
  onToggleCompare,
  selectedForCompare,
  initialTab = 'seasons',
  initialSharkId,
}) => {
  const [activeTab, setActiveTab] = useState<ArchiveTab>(initialTab);

  // Seasons State
  const [seasons, setSeasons] = useState<HistoricalSeason[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState<boolean>(true);
  const [seasonsError, setSeasonsError] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);

  // Episodes State
  const [episodes, setEpisodes] = useState<HistoricalEpisode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState<boolean>(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);

  // Episode Detail Modal State
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [episodeDetail, setEpisodeDetail] = useState<HistoricalEpisodeDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Pitches State
  const [pitches, setPitches] = useState<HistoricalPitchRow[]>([]);
  const [loadingPitches, setLoadingPitches] = useState<boolean>(false);
  const [pitchesError, setPitchesError] = useState<string | null>(null);
  const [pitchFilters, setPitchFilters] = useState<HistoricalPitchFilters>({
    search: '',
    seasonId: undefined,
    sharkId: initialSharkId,
    dealStatus: undefined,
  });

  // Sharks State
  const [sharks, setSharks] = useState<HistoricalShark[]>([]);
  const [loadingSharks, setLoadingSharks] = useState<boolean>(false);
  const [sharksError, setSharksError] = useState<string | null>(null);
  const [sharkSearch, setSharkSearch] = useState<string>('');
  const [sharkTypeFilter, setSharkTypeFilter] = useState<'ALL' | 'REGULAR' | 'GUEST'>('ALL');

  // Statistics State
  const [statistics, setStatistics] = useState<HistoricalStatistics | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // 1. Load Seasons on mount
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoadingSeasons(true);
      setSeasonsError(null);
      try {
        const data = await fetchHistoricalSeasons(100, 0, undefined, controller.signal);
        if (!controller.signal.aborted) {
          setSeasons(data);
          if (data.length > 0 && selectedSeasonId === null) {
            setSelectedSeasonId(data[0].seasonId);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setSeasonsError(err instanceof Error ? err.message : 'Failed to load historical seasons.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSeasons(false);
        }
      }
    })();

    return () => controller.abort();
  }, [selectedSeasonId]);

  // 2. Load Episodes when selectedSeasonId changes
  useEffect(() => {
    if (selectedSeasonId === null) {
      return;
    }

    const controller = new AbortController();
    void (async () => {
      setLoadingEpisodes(true);
      setEpisodesError(null);
      try {
        const data = await fetchHistoricalEpisodes(selectedSeasonId, 100, 0, controller.signal);
        if (!controller.signal.aborted) {
          setEpisodes(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setEpisodesError(err instanceof Error ? err.message : 'Failed to load episodes for this season.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingEpisodes(false);
        }
      }
    })();

    return () => controller.abort();
  }, [selectedSeasonId]);

  // 3. Load Episode Detail when an episode is selected
  useEffect(() => {
    if (selectedEpisodeId === null) {
      return;
    }

    const controller = new AbortController();
    void (async () => {
      setLoadingDetail(true);
      setDetailError(null);
      try {
        const detail = await fetchHistoricalEpisodeDetail(selectedEpisodeId, controller.signal);
        if (!controller.signal.aborted) {
          setEpisodeDetail(detail);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setDetailError(err instanceof Error ? err.message : 'Failed to load episode details.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingDetail(false);
        }
      }
    })();

    return () => controller.abort();
  }, [selectedEpisodeId]);

  // 4. Load Pitches when tab is pitches or filters change
  useEffect(() => {
    if (activeTab !== 'pitches') return;

    const controller = new AbortController();
    void (async () => {
      setLoadingPitches(true);
      setPitchesError(null);
      try {
        const data = await fetchHistoricalPitches(pitchFilters, controller.signal);
        if (!controller.signal.aborted) {
          setPitches(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setPitchesError(err instanceof Error ? err.message : 'Failed to load historical pitches.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingPitches(false);
        }
      }
    })();

    return () => controller.abort();
  }, [activeTab, pitchFilters]);

  // 5. Load Sharks when tab is sharks or pitches (needed for dropdown filter)
  useEffect(() => {
    if (activeTab !== 'sharks' && activeTab !== 'pitches') return;
    if (sharks.length > 0) return;

    const controller = new AbortController();
    void (async () => {
      setLoadingSharks(true);
      setSharksError(null);
      try {
        const data = await fetchHistoricalSharks(controller.signal);
        if (!controller.signal.aborted) {
          setSharks(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setSharksError(err instanceof Error ? err.message : 'Failed to load Sharks roster.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSharks(false);
        }
      }
    })();

    return () => controller.abort();
  }, [activeTab, sharks.length]);

  // 6. Load Statistics when tab is statistics
  useEffect(() => {
    if (activeTab !== 'statistics') return;
    if (statistics !== null) return;

    const controller = new AbortController();
    void (async () => {
      setLoadingStats(true);
      setStatsError(null);
      try {
        const data = await fetchHistoricalStatistics(controller.signal);
        if (!controller.signal.aborted) {
          setStatistics(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setStatsError(err instanceof Error ? err.message : 'Failed to calculate historical statistics.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingStats(false);
        }
      }
    })();

    return () => controller.abort();
  }, [activeTab, statistics]);

  const selectedSeason = seasons.find((s) => s.seasonId === selectedSeasonId) ?? null;

  // Filter Sharks list
  const filteredSharks = sharks.filter((shark) => {
    const q = sharkSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      shark.displayName.toLowerCase().includes(q) ||
      (shark.stageName && shark.stageName.toLowerCase().includes(q)) ||
      (shark.investmentFirmName && shark.investmentFirmName.toLowerCase().includes(q));

    const isGuest = Boolean(shark.isGuestShark);
    const matchesType =
      sharkTypeFilter === 'ALL' ||
      (sharkTypeFilter === 'GUEST' && isGuest) ||
      (sharkTypeFilter === 'REGULAR' && !isGuest);

    return matchesSearch && matchesType;
  });

  return (
    <section className="historical-archive-page" aria-labelledby="archive-page-heading">
      <div className="archive-container">
        {/* Masthead / Header */}
        <header className="archive-header">
          <div className="archive-header-breadcrumbs">
            <button
              type="button"
              className="archive-back-btn"
              onClick={onNavigateToDiscovery}
              aria-label="Return to Startup Registry"
            >
              ← Return to Startup Registry
            </button>
            <span className="archive-sep">/</span>
            <span className="archive-crumb">Shark Tank Broadcast Archive</span>
          </div>

          <div className="archive-header-title-block">
            <div className="archive-eyebrow">
              <span className="archive-eyebrow-line" />
              <span>SHARK TANK ARCHIVE · BROADCAST VAULT</span>
            </div>
            <h1 id="archive-page-heading" className="archive-title">
              Televised Broadcasts & Outcomes<span>.</span>
            </h1>
            <p className="archive-subtitle">
              Browse broadcast seasons, episode seating, historical negotiation logs, and post-tank deal completions preserved in the Sauda registry.
            </p>
          </div>

          {/* Tab Navigation */}
          <nav className="archive-nav-tabs" aria-label="Archive sections">
            <button
              type="button"
              className={`archive-tab-btn ${activeTab === 'seasons' ? 'active' : ''}`}
              onClick={() => setActiveTab('seasons')}
              aria-current={activeTab === 'seasons' ? 'page' : undefined}
            >
              <span>Seasons & Episodes</span>
              {seasons.length > 0 && <span className="tab-pill">{seasons.length}</span>}
            </button>

            <button
              type="button"
              className={`archive-tab-btn ${activeTab === 'pitches' ? 'active' : ''}`}
              onClick={() => setActiveTab('pitches')}
              aria-current={activeTab === 'pitches' ? 'page' : undefined}
            >
              <span>Historical Pitches</span>
            </button>

            <button
              type="button"
              className={`archive-tab-btn ${activeTab === 'sharks' ? 'active' : ''}`}
              onClick={() => setActiveTab('sharks')}
              aria-current={activeTab === 'sharks' ? 'page' : undefined}
            >
              <span>Sharks Roster</span>
              {sharks.length > 0 && <span className="tab-pill">{sharks.length}</span>}
            </button>

            <button
              type="button"
              className={`archive-tab-btn ${activeTab === 'statistics' ? 'active' : ''}`}
              onClick={() => setActiveTab('statistics')}
              aria-current={activeTab === 'statistics' ? 'page' : undefined}
            >
              <span>Broadcast Analytics</span>
            </button>
          </nav>
        </header>

        {/* ========================================================================= */}
        {/* TAB 1: SEASONS & EPISODES EXPLORER */}
        {/* ========================================================================= */}
        {activeTab === 'seasons' && (
          <div className="archive-section seasons-section">
            <div className="season-selector-bar">
              <div className="selector-title">
                <h2>Browse Seasons</h2>
                <span className="selector-count">{seasons.length} Available</span>
              </div>

              {loadingSeasons ? (
                <div className="archive-loading-row" role="status">Loading seasons from registry…</div>
              ) : seasonsError ? (
                <div className="archive-error-banner" role="alert">
                  <span>⚠</span>
                  <span>{seasonsError}</span>
                </div>
              ) : seasons.length === 0 ? (
                <div className="archive-empty-notice">No historical seasons found in the registry.</div>
              ) : (
                <div className="season-pills-scroll" role="tablist" aria-label="Broadcast seasons">
                  {seasons.map((s) => {
                    const isSelected = s.seasonId === selectedSeasonId;
                    return (
                      <button
                        key={s.seasonId}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        className={`season-pill ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedSeasonId(s.seasonId)}
                      >
                        <span className="pill-season-num">Season {s.seasonNumber}</span>
                        <span className="pill-franchise">{s.countryFranchise}</span>
                        {s.storedEpisodeCount !== undefined && (
                          <span className="pill-ep-count">{s.storedEpisodeCount} eps</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Season Header Info */}
            {selectedSeason && (
              <div className="selected-season-meta-card">
                <div className="season-meta-headline">
                  <div>
                    <span className="meta-franchise-tag">{selectedSeason.countryFranchise}</span>
                    <h3>Season {selectedSeason.seasonNumber}</h3>
                  </div>
                  {selectedSeason.networkChannel && (
                    <div className="season-network">
                      <span className="network-label">Broadcast Network:</span>
                      <strong>{selectedSeason.networkChannel}</strong>
                    </div>
                  )}
                </div>

                <div className="season-meta-grid">
                  <div className="season-meta-item">
                    <span className="meta-label">Premiere Date</span>
                    <strong>{formatDateSafe(selectedSeason.premiereDate)}</strong>
                  </div>
                  <div className="season-meta-item">
                    <span className="meta-label">Finale Date</span>
                    <strong>{formatDateSafe(selectedSeason.finaleDate)}</strong>
                  </div>
                  <div className="season-meta-item">
                    <span className="meta-label">Total Broadcast Episodes</span>
                    <strong>{selectedSeason.totalEpisodes ?? selectedSeason.storedEpisodeCount ?? '—'}</strong>
                  </div>
                  <div className="season-meta-item">
                    <span className="meta-label">Stored Pitches</span>
                    <strong>{selectedSeason.storedPitchCount ?? '—'}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Episodes List */}
            <div className="episodes-list-block">
              <div className="episodes-block-header">
                <h3>Episodes in Season {selectedSeason?.seasonNumber ?? ''}</h3>
                <span className="episodes-count">{episodes.length} episodes recorded</span>
              </div>

              {loadingEpisodes ? (
                <div className="episodes-grid-skeletons" aria-label="Loading episodes…">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="episode-skeleton-card" />
                  ))}
                </div>
              ) : episodesError ? (
                <div className="archive-error-banner" role="alert">
                  <span>⚠</span>
                  <span>{episodesError}</span>
                </div>
              ) : episodes.length === 0 ? (
                <div className="archive-empty-panel">
                  <div className="empty-symbol" aria-hidden="true">📺</div>
                  <h4>No episodes recorded for this season</h4>
                  <p>Episode archives for Season {selectedSeason?.seasonNumber} have not yet been imported.</p>
                </div>
              ) : (
                <div className="episodes-grid">
                  {episodes.map((ep) => (
                    <article className="episode-card" key={ep.episodeId}>
                      <div className="episode-card-top">
                        <span className="episode-num-badge">EPISODE {String(ep.episodeNumber).padStart(2, '0')}</span>
                        {ep.airDate && (
                          <span className="episode-air-date">{formatDateSafe(ep.airDate)}</span>
                        )}
                      </div>

                      <h4 className="episode-title">{ep.episodeTitle || `Season ${selectedSeason?.seasonNumber} Episode ${ep.episodeNumber}`}</h4>

                      <div className="episode-telemetry-row">
                        {ep.durationMinutes !== null && (
                          <span className="ep-tag">{ep.durationMinutes} mins</span>
                        )}
                        {ep.tvRating && (
                          <span className="ep-tag rating-tag">{ep.tvRating}</span>
                        )}
                        {ep.viewersCountMillions !== null && Number(ep.viewersCountMillions) > 0 && (
                          <span className="ep-tag viewers-tag">{ep.viewersCountMillions}M Viewers</span>
                        )}
                        {ep.pitchCount !== undefined && (
                          <span className="ep-tag pitch-count-tag">{ep.pitchCount} {ep.pitchCount === 1 ? 'Pitch' : 'Pitches'}</span>
                        )}
                        {ep.sharkCount !== undefined && (
                          <span className="ep-tag shark-count-tag">{ep.sharkCount} Sharks</span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="episode-explore-btn"
                        onClick={() => setSelectedEpisodeId(ep.episodeId)}
                        aria-label={`Inspect pitches and panel for Episode ${ep.episodeNumber}`}
                      >
                        <span>Inspect Episode Archive</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: HISTORICAL PITCHES DISCOVERY */}
        {/* ========================================================================= */}
        {activeTab === 'pitches' && (
          <div className="archive-section pitches-section">
            <div className="pitches-filter-bar">
              <div className="pitches-search-box">
                <span className="search-icon" aria-hidden="true">⌕</span>
                <input
                  type="search"
                  placeholder="Search historical pitches by brand, legal name, hook…"
                  value={pitchFilters.search ?? ''}
                  onChange={(e) => setPitchFilters((prev) => ({ ...prev, search: e.target.value }))}
                  aria-label="Search broadcast pitches"
                />
              </div>

              <div className="pitches-dropdowns">
                <label className="filter-select-label">
                  <span className="sr-only">Filter by season</span>
                  <select
                    value={pitchFilters.seasonId ?? ''}
                    onChange={(e) =>
                      setPitchFilters((prev) => ({
                        ...prev,
                        seasonId: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  >
                    <option value="">All Seasons</option>
                    {seasons.map((s) => (
                      <option key={s.seasonId} value={s.seasonId}>
                        Season {s.seasonNumber} ({s.countryFranchise})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="filter-select-label">
                  <span className="sr-only">Filter by deal outcome</span>
                  <select
                    value={pitchFilters.dealStatus ?? ''}
                    onChange={(e) =>
                      setPitchFilters((prev) => ({
                        ...prev,
                        dealStatus: (e.target.value || undefined) as HistoricalPitchFilters['dealStatus'],
                      }))
                    }
                  >
                    <option value="">All Deal Outcomes</option>
                    <option value="COMPLETED">Deal Completed</option>
                    <option value="FELL_THROUGH">Deal Fell Through</option>
                    <option value="PENDING_DUE_DILIGENCE">Pending Due Diligence</option>
                    <option value="UNKNOWN">No Deal Recorded / Walked</option>
                  </select>
                </label>

                <label className="filter-select-label">
                  <span className="sr-only">Filter by shark</span>
                  <select
                    value={pitchFilters.sharkId ?? ''}
                    onChange={(e) =>
                      setPitchFilters((prev) => ({
                        ...prev,
                        sharkId: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  >
                    <option value="">All Sharks</option>
                    {sharks.map((sh) => (
                      <option key={sh.sharkId} value={sh.sharkId}>
                        {sh.displayName} {sh.isGuestShark ? '(Guest)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                {(pitchFilters.search || pitchFilters.seasonId || pitchFilters.dealStatus || pitchFilters.sharkId) && (
                  <button
                    type="button"
                    className="archive-reset-filters-btn"
                    onClick={() =>
                      setPitchFilters({
                        search: '',
                        seasonId: undefined,
                        sharkId: undefined,
                        dealStatus: undefined,
                      })
                    }
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>

            <div className="pitches-count-row" role="status" aria-live="polite">
              <span>Showing <strong>{pitches.length}</strong> broadcast {pitches.length === 1 ? 'pitch' : 'pitches'}</span>
            </div>

            {loadingPitches ? (
              <div className="archive-pitches-skeletons" aria-label="Loading historical pitches…">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="pitch-skeleton-card" />
                ))}
              </div>
            ) : pitchesError ? (
              <div className="archive-error-banner" role="alert">
                <span>⚠</span>
                <span>{pitchesError}</span>
              </div>
            ) : pitches.length === 0 ? (
              <div className="archive-empty-panel">
                <div className="empty-symbol" aria-hidden="true">⚖</div>
                <h4>No historical pitches match your criteria</h4>
                <p>Try clearing filters or searching for another company or sector.</p>
                <button
                  type="button"
                  className="archive-btn-primary"
                  onClick={() =>
                    setPitchFilters({
                      search: '',
                      seasonId: undefined,
                      sharkId: undefined,
                      dealStatus: undefined,
                    })
                  }
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              <div className="archive-pitches-grid">
                {pitches.map((p) => {
                  const startup = historicalPitchRowToStartup(p);
                  const isSelectedForCompare = selectedForCompare.some((s) => s.pitchId === p.pitchId);

                  return (
                    <article className="archive-pitch-card" key={p.pitchId}>
                      <div className="card-topline">
                        <span className="pitch-badge show">
                          <span className="badge-dot" />
                          SHARK TANK SHOW
                        </span>
                        <span className="pitch-number">{formatPitchNumber(p.pitchId)}</span>
                        <span className="pitch-seq-tag">
                          S{p.seasonNumber} · Ep {p.episodeNumber}
                        </span>
                      </div>

                      <div className="company-monogram" aria-hidden="true">
                        {p.brandName.trim().charAt(0).toUpperCase() || 'S'}
                      </div>

                      <h3>{p.brandName}</h3>
                      {p.legalBusinessName && <p className="legal-name">{p.legalBusinessName}</p>}

                      <p className="pitch-hook">{p.pitchHook || 'Televised venture presentation.'}</p>

                      <div className="tag-row">
                        {p.industry && <span className="info-tag">{p.industry}</span>}
                        {p.countryFranchise && (
                          <span className="info-tag franchise-tag">{p.countryFranchise}</span>
                        )}
                      </div>

                      <div className="card-facts">
                        <div>
                          <span className="fact-label">ORIGINAL ASK</span>
                          <strong className="ask-value tabular-nums">{formatCurrency(p.originalAskAmount)}</strong>
                        </div>
                        <div>
                          <span className="fact-label">REQUESTED EQUITY</span>
                          <strong className="tabular-nums">{formatEquity(p.originalAskEquityPct)}</strong>
                        </div>
                      </div>

                      {/* Deal Outcome Badge */}
                      <div className="deal-outcome-row">
                        <span className="outcome-label">BROADCAST OUTCOME:</span>
                        {p.dealStatus === 'COMPLETED' ? (
                          <span className="outcome-pill completed">
                            ✓ Deal Closed {p.finalAgreedAmount ? `· ${formatCurrency(p.finalAgreedAmount)} for ${formatEquity(p.finalAgreedEquityPct)}` : ''}
                          </span>
                        ) : p.dealStatus === 'FELL_THROUGH' ? (
                          <span className="outcome-pill fell-through">✕ Deal Fell Through Post-Show</span>
                        ) : p.dealStatus === 'PENDING_DUE_DILIGENCE' ? (
                          <span className="outcome-pill pending">⏳ In Due Diligence</span>
                        ) : (
                          <span className="outcome-pill walked">No Deal / Walked Away</span>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="card-actions-row">
                        <button
                          type="button"
                          className="card-btn card-btn-details"
                          onClick={() => onSelectStartup(startup)}
                          aria-label={`View full details for ${p.brandName}`}
                        >
                          <span>View Details</span>
                          <span aria-hidden="true">→</span>
                        </button>

                        <button
                          type="button"
                          className={`card-btn card-btn-compare ${isSelectedForCompare ? 'selected' : ''}`}
                          onClick={() => onToggleCompare(startup)}
                          aria-pressed={isSelectedForCompare}
                          aria-label={`${isSelectedForCompare ? 'Remove' : 'Add'} ${p.brandName} to comparison`}
                        >
                          <span aria-hidden="true">{isSelectedForCompare ? '✓' : '+'}</span>
                          <span>{isSelectedForCompare ? 'Selected' : 'Compare'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SHARKS ROSTER */}
        {/* ========================================================================= */}
        {activeTab === 'sharks' && (
          <div className="archive-section sharks-section">
            <div className="sharks-toolbar">
              <div className="sharks-search-box">
                <span className="search-icon" aria-hidden="true">⌕</span>
                <input
                  type="search"
                  placeholder="Search Sharks by name, firm, or stage name…"
                  value={sharkSearch}
                  onChange={(e) => setSharkSearch(e.target.value)}
                  aria-label="Search Sharks roster"
                />
              </div>

              <div className="shark-filter-group" role="group" aria-label="Filter Sharks by appearance role">
                {(['ALL', 'REGULAR', 'GUEST'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`shark-filter-btn ${sharkTypeFilter === t ? 'active' : ''}`}
                    aria-pressed={sharkTypeFilter === t}
                    onClick={() => setSharkTypeFilter(t)}
                  >
                    {t === 'ALL' ? 'All Sharks' : t === 'REGULAR' ? 'Main Sharks' : 'Guest Sharks'}
                  </button>
                ))}
              </div>
            </div>

            {loadingSharks ? (
              <div className="sharks-grid-skeletons" aria-label="Loading Sharks…">
                {[1, 2, 3, 4, 5, 6].map((k) => (
                  <div key={k} className="shark-skeleton-card" />
                ))}
              </div>
            ) : sharksError ? (
              <div className="archive-error-banner" role="alert">
                <span>⚠</span>
                <span>{sharksError}</span>
              </div>
            ) : filteredSharks.length === 0 ? (
              <div className="archive-empty-panel">
                <div className="empty-symbol" aria-hidden="true">🦈</div>
                <h4>No Sharks match your search</h4>
                <p>Try clearing your search query or switching between main and guest sharks.</p>
              </div>
            ) : (
              <div className="sharks-grid">
                {filteredSharks.map((sh) => (
                  <article className="shark-card" key={sh.sharkId}>
                    <div className="shark-card-header">
                      <div className="shark-monogram" aria-hidden="true">
                        {sh.displayName.trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="shark-identity-main">
                        <h3>{sh.displayName}</h3>
                        {sh.stageName && sh.stageName !== sh.displayName && (
                          <span className="shark-stage-name">&ldquo;{sh.stageName}&rdquo;</span>
                        )}
                        {sh.investmentFirmName && (
                          <span className="shark-firm">{sh.investmentFirmName}</span>
                        )}
                      </div>
                    </div>

                    <div className="shark-card-meta">
                      <span className={`shark-status-badge ${sh.isGuestShark ? 'guest' : 'regular'}`}>
                        {sh.isGuestShark ? 'Guest Shark' : 'Main Panel Shark'}
                      </span>
                      {sh.episodeCount !== undefined && (
                        <span className="shark-episodes-badge">
                          <strong>{sh.episodeCount}</strong> {sh.episodeCount === 1 ? 'Episode' : 'Episodes'}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="shark-pitches-link-btn"
                      onClick={() => {
                        setPitchFilters({
                          search: '',
                          seasonId: undefined,
                          sharkId: sh.sharkId,
                          dealStatus: undefined,
                        });
                        setActiveTab('pitches');
                      }}
                      aria-label={`View broadcast pitches evaluated by ${sh.displayName}`}
                    >
                      <span>Explore Deals Evaluated</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: BROADCAST STATISTICS */}
        {/* ========================================================================= */}
        {activeTab === 'statistics' && (
          <div className="archive-section statistics-section">
            <div className="stats-header-banner">
              <div>
                <h2>Verified Broadcast Analytics</h2>
                <p>Calculated directly from confirmed MySQL historical records. No estimated or fabricated rates.</p>
              </div>
            </div>

            {loadingStats ? (
              <div className="archive-loading-row" role="status">Calculating broadcast statistics from verified database records…</div>
            ) : statsError ? (
              <div className="archive-error-banner" role="alert">
                <span>⚠</span>
                <span>{statsError}</span>
              </div>
            ) : !statistics ? (
              <div className="archive-empty-panel">No historical statistics available.</div>
            ) : (
              <div className="stats-tables-container">
                {/* 1. Deals by Season */}
                <div className="stats-block">
                  <div className="stats-block-title">
                    <h3>Deals by Broadcast Season</h3>
                    <span className="stats-block-sub">Historical pitch totals and closed agreements</span>
                  </div>
                  <div className="stats-table-wrapper">
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>Season</th>
                          <th>Franchise</th>
                          <th>Pitches Broadcast</th>
                          <th>Completed Deals</th>
                          <th>Fell Through</th>
                          <th>Due Diligence</th>
                          <th>No Recorded Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statistics.dealsBySeason.map((row) => (
                          <tr key={`${row.countryFranchise}-${row.seasonNumber}`}>
                            <td><strong>Season {row.seasonNumber}</strong></td>
                            <td>{row.countryFranchise}</td>
                            <td className="tabular-nums"><strong>{row.pitchCount}</strong></td>
                            <td className="tabular-nums text-green">{row.completedDeals}</td>
                            <td className="tabular-nums text-red">{row.fellThroughDeals}</td>
                            <td className="tabular-nums text-amber">{row.pendingDeals}</td>
                            <td className="tabular-nums text-muted">{row.noRecordedOutcome}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Sector Distribution */}
                <div className="stats-block">
                  <div className="stats-block-title">
                    <h3>Industry Sector Distribution</h3>
                    <span className="stats-block-sub">Pitches and outcomes categorized by industry classification</span>
                  </div>
                  <div className="stats-table-wrapper">
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>Industry</th>
                          <th>Broadcast Pitches</th>
                          <th>Completed Deals</th>
                          <th>Fell Through</th>
                          <th>No Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statistics.sectorDistribution.map((row) => (
                          <tr key={row.industryId}>
                            <td><strong>{row.industryName}</strong></td>
                            <td className="tabular-nums"><strong>{row.pitchCount}</strong></td>
                            <td className="tabular-nums text-green">{row.completedDeals}</td>
                            <td className="tabular-nums text-red">{row.fellThroughDeals}</td>
                            <td className="tabular-nums text-muted">{row.noRecordedOutcome}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Shark Floor Activity */}
                <div className="stats-block">
                  <div className="stats-block-title">
                    <h3>Shark Panel Activity</h3>
                    <span className="stats-block-sub">Verified episode appearances and pitches evaluated</span>
                  </div>
                  <div className="stats-table-wrapper">
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>Shark</th>
                          <th>Episodes Seated</th>
                          <th>Pitches Evaluated</th>
                          <th>Completed Deals Associated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statistics.sharkActivity.map((row) => (
                          <tr key={row.sharkId}>
                            <td><strong>{row.displayName}</strong></td>
                            <td className="tabular-nums">{row.episodesAppeared}</td>
                            <td className="tabular-nums"><strong>{row.pitchesSeen}</strong></td>
                            <td className="tabular-nums text-green">{row.completedDealsAssociated}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* EPISODE DETAIL MODAL / DRAWER */}
        {/* ========================================================================= */}
        {selectedEpisodeId !== null && (
          <div
            className="modal-backdrop episode-modal-backdrop"
            onClick={() => setSelectedEpisodeId(null)}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="episode-detail-heading"
              className="episode-detail-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="episode-modal-header">
                <div>
                  <div className="modal-eyebrow">
                    <span>EPISODE ARCHIVE DOSSIER</span>
                  </div>
                  <h2 id="episode-detail-heading">
                    {episodeDetail?.episode.episodeTitle ||
                      `Episode #${String(episodeDetail?.episode.episodeNumber ?? '').padStart(2, '0')}`}
                  </h2>
                  {episodeDetail?.episode && (
                    <p className="modal-sub">
                      Season {episodeDetail.episode.seasonNumber} · {episodeDetail.episode.countryFranchise} · Air Date: {formatDateSafe(episodeDetail.episode.airDate)}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setSelectedEpisodeId(null)}
                  aria-label="Close episode detail"
                >
                  ×
                </button>
              </div>

              <div className="episode-modal-body">
                {loadingDetail ? (
                  <div className="archive-loading-row" role="status">Loading episode broadcast dossier…</div>
                ) : detailError ? (
                  <div className="archive-error-banner" role="alert">
                    <span>⚠</span>
                    <span>{detailError}</span>
                  </div>
                ) : !episodeDetail ? (
                  <div className="archive-empty-panel">Episode details could not be found.</div>
                ) : (
                  <>
                    {/* Sharks on the Panel */}
                    <div className="episode-dossier-section">
                      <h3>Sharks on the Panel ({episodeDetail.sharks.length})</h3>
                      {episodeDetail.sharks.length === 0 ? (
                        <p className="dossier-empty-text">No seating records found for this episode.</p>
                      ) : (
                        <div className="episode-sharks-list">
                          {episodeDetail.sharks.map((sh) => (
                            <div className="episode-shark-chip" key={sh.sharkId}>
                              <span className="chair-badge">Chair {sh.chairPositionNumber}</span>
                              <div className="shark-chip-info">
                                <strong>{sh.displayName}</strong>
                                {sh.investmentFirmName && <small>{sh.investmentFirmName}</small>}
                              </div>
                              {sh.isGuestShark ? <span className="guest-pill">Guest</span> : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pitches Broadcast */}
                    <div className="episode-dossier-section">
                      <h3>Broadcast Pitches ({episodeDetail.pitches.length})</h3>
                      {episodeDetail.pitches.length === 0 ? (
                        <p className="dossier-empty-text">No pitch records recorded for this broadcast episode.</p>
                      ) : (
                        <div className="episode-pitches-list">
                          {episodeDetail.pitches.map((p) => {
                            const startupObj: Startup = {
                              pitchId: p.pitchId,
                              pitchType: 'SHOW',
                              originalAskAmount: p.originalAskAmount,
                              originalAskEquityPct: p.originalAskEquityPct,
                              pitchHook: p.pitchHook,
                              submittedAt: '',
                              companyId: p.companyId,
                              brandName: p.brandName,
                              legalBusinessName: p.legalBusinessName,
                              businessModel: p.businessModel,
                              websiteUrl: p.websiteUrl,
                              foundedYear: p.foundedYear,
                              headquartersCity: p.headquartersCity,
                              headquartersState: p.headquartersState,
                              headquartersCountry: p.headquartersCountry,
                              industry: p.industry,
                              startupStage: p.startupStage,
                            };
                            const isSelected = selectedForCompare.some((s) => s.pitchId === p.pitchId);

                            return (
                              <div className="dossier-pitch-row" key={p.pitchId}>
                                <div className="dossier-pitch-main">
                                  <div className="dossier-top">
                                    <span className="seq-number">Pitch #{p.pitchSequenceOrder}</span>
                                    <h4>{p.brandName}</h4>
                                    {p.industry && <span className="info-tag">{p.industry}</span>}
                                  </div>
                                  <p className="dossier-hook">{p.pitchHook || 'No hook provided.'}</p>
                                  <div className="dossier-numbers">
                                    <span>Ask: <strong>{formatCurrency(p.originalAskAmount)}</strong> for <strong>{formatEquity(p.originalAskEquityPct)}</strong></span>
                                    {p.dealStatus && (
                                      <span className={`outcome-pill ${p.dealStatus === 'COMPLETED' ? 'completed' : p.dealStatus === 'FELL_THROUGH' ? 'fell-through' : 'pending'}`}>
                                        {p.dealStatus === 'COMPLETED' ? 'Deal Completed' : p.dealStatus === 'FELL_THROUGH' ? 'Fell Through' : 'In Due Diligence'}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="dossier-pitch-actions">
                                  <button
                                    type="button"
                                    className="dossier-action-btn"
                                    onClick={() => {
                                      setSelectedEpisodeId(null);
                                      onSelectStartup(startupObj);
                                    }}
                                  >
                                    View Full Dossier
                                  </button>
                                  <button
                                    type="button"
                                    className={`dossier-compare-btn ${isSelected ? 'selected' : ''}`}
                                    onClick={() => onToggleCompare(startupObj)}
                                  >
                                    {isSelected ? '✓ In Compare' : '+ Compare'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Offers Made */}
                    {episodeDetail.offers.length > 0 && (
                      <div className="episode-dossier-section">
                        <h3>Recorded Tank Negotiations & Offers ({episodeDetail.offers.length})</h3>
                        <div className="offers-table-wrapper">
                          <table className="stats-table">
                            <thead>
                              <tr>
                                <th>Round</th>
                                <th>Investor</th>
                                <th>Offered Amount</th>
                                <th>Equity %</th>
                                <th>Type</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {episodeDetail.offers.map((off) => (
                                <tr key={off.offerId}>
                                  <td>Round {off.roundNumber}</td>
                                  <td><strong>{off.createdByInvestorName || 'Unknown Shark'}</strong></td>
                                  <td className="tabular-nums">{formatCurrency(off.amountOffered)}</td>
                                  <td className="tabular-nums">{formatEquity(off.equityRequestedPct)}</td>
                                  <td>{off.isCounterOffer ? 'Counter Offer' : 'Initial Offer'}</td>
                                  <td><span className="offer-status-tag">{off.offerStatus}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="episode-modal-footer">
                <button
                  type="button"
                  className="panel-btn"
                  onClick={() => setSelectedEpisodeId(null)}
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
