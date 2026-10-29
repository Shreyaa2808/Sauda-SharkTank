import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchHistoricalSeasons,
  createHistoricalSeason,
  updateHistoricalSeason,
  deleteHistoricalSeason,
  fetchHistoricalEpisodes,
  createHistoricalEpisode,
  updateHistoricalEpisode,
  deleteHistoricalEpisode,
  fetchHistoricalSharks,
  createHistoricalShark,
  updateHistoricalShark,
  deleteHistoricalShark,
  type HistoricalSeason,
  type HistoricalEpisode,
  type HistoricalShark,
  type CreateSeasonPayload,
  type CreateEpisodePayload,
  type CreateSharkPayload,
} from '../../services/admin.ts';
import './AdminHistoricalManager.css';

type HistoricalTab = 'seasons' | 'episodes' | 'sharks';

export const AdminHistoricalManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<HistoricalTab>('seasons');

  // Loading and Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Data lists
  const [seasons, setSeasons] = useState<HistoricalSeason[]>([]);
  const [episodes, setEpisodes] = useState<HistoricalEpisode[]>([]);
  const [sharks, setSharks] = useState<HistoricalShark[]>([]);

  // Selected filters
  const [selectedSeasonIdForEpisodes, setSelectedSeasonIdForEpisodes] = useState<number | null>(null);
  const [seasonSearch, setSeasonSearch] = useState('');
  const [sharkSearch, setSharkSearch] = useState('');

  // Modals state
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<HistoricalSeason | null>(null);
  const [seasonForm, setSeasonForm] = useState<CreateSeasonPayload>({
    seasonNumber: 1,
    countryFranchise: 'India',
    premiereDate: '',
    finaleDate: '',
    totalEpisodes: 20,
    networkChannel: 'Sony LIV',
    productionHouse: '',
    budgetAmount: 0,
  });

  const [isEpisodeModalOpen, setIsEpisodeModalOpen] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<HistoricalEpisode | null>(null);
  const [episodeForm, setEpisodeForm] = useState<CreateEpisodePayload>({
    seasonId: 1,
    episodeNumber: 1,
    episodeTitle: '',
    tapeDate: '',
    airDate: '',
    durationMinutes: 45,
    tvRating: 8.5,
    viewersCountMillions: 3.5,
    filmingLocation: 'Mumbai',
    videoUrl: '',
  });

  const [isSharkModalOpen, setIsSharkModalOpen] = useState(false);
  const [editingShark, setEditingShark] = useState<HistoricalShark | null>(null);
  const [sharkForm, setSharkForm] = useState<CreateSharkPayload>({
    displayName: '',
    investmentFirmName: '',
    stageName: '',
    gender: 'Male',
    birthDate: '',
    isGuestShark: false,
  });

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'season' | 'episode' | 'shark';
    id: number;
    title: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load Seasons
  const loadSeasons = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchHistoricalSeasons(100, 0, undefined, signal);
      setSeasons(data);
      if (data.length > 0 && selectedSeasonIdForEpisodes === null) {
        setSelectedSeasonIdForEpisodes(data[0].seasonId);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load historical seasons.');
    }
  }, [selectedSeasonIdForEpisodes]);

  // Load Episodes for selected season
  const loadEpisodes = useCallback(async (seasonId: number, signal?: AbortSignal) => {
    try {
      const data = await fetchHistoricalEpisodes(seasonId, 100, 0, signal);
      setEpisodes(data);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load historical episodes.');
    }
  }, []);

  // Load Sharks
  const loadSharks = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchHistoricalSharks(signal);
      setSharks(data);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load historical sharks.');
    }
  }, []);

  // Initial load depending on active tab
  useEffect(() => {
    const controller = new AbortController();

    async function init() {
      setLoading(true);
      setError(null);
      if (activeTab === 'seasons') {
        await loadSeasons(controller.signal);
      } else if (activeTab === 'episodes') {
        if (seasons.length === 0) {
          await loadSeasons(controller.signal);
        }
        if (selectedSeasonIdForEpisodes) {
          await loadEpisodes(selectedSeasonIdForEpisodes, controller.signal);
        }
      } else if (activeTab === 'sharks') {
        await loadSharks(controller.signal);
      }
      setLoading(false);
    }

    void init();
    return () => controller.abort();
  }, [activeTab, loadSeasons, loadEpisodes, loadSharks, selectedSeasonIdForEpisodes, seasons.length]);

  // Auto-dismiss transient feedback message
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // ==========================================================================
  // SEASON CRUD HANDLERS
  // ==========================================================================

  const handleOpenAddSeason = () => {
    setEditingSeason(null);
    setSeasonForm({
      seasonNumber: seasons.length + 1,
      countryFranchise: 'India',
      premiereDate: '',
      finaleDate: '',
      totalEpisodes: 20,
      networkChannel: 'Sony LIV',
      productionHouse: '',
      budgetAmount: 0,
    });
    setIsSeasonModalOpen(true);
  };

  const handleOpenEditSeason = (s: HistoricalSeason) => {
    setEditingSeason(s);
    setSeasonForm({
      seasonNumber: s.seasonNumber,
      countryFranchise: s.countryFranchise,
      premiereDate: s.premiereDate ? String(s.premiereDate).slice(0, 10) : '',
      finaleDate: s.finaleDate ? String(s.finaleDate).slice(0, 10) : '',
      totalEpisodes: s.totalEpisodes ?? 0,
      networkChannel: s.networkChannel ?? '',
      productionHouse: s.productionHouse ?? '',
      budgetAmount: 0,
    });
    setIsSeasonModalOpen(true);
  };

  const handleSaveSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      if (editingSeason) {
        await updateHistoricalSeason(editingSeason.seasonId, seasonForm);
        setFeedback({ type: 'success', message: `Season ${seasonForm.seasonNumber} updated successfully.` });
      } else {
        await createHistoricalSeason(seasonForm);
        setFeedback({ type: 'success', message: `Season ${seasonForm.seasonNumber} created successfully.` });
      }
      setIsSeasonModalOpen(false);
      await loadSeasons();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save season.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================================
  // EPISODE CRUD HANDLERS
  // ==========================================================================

  const handleOpenAddEpisode = () => {
    setEditingEpisode(null);
    setEpisodeForm({
      seasonId: selectedSeasonIdForEpisodes || seasons[0]?.seasonId || 1,
      episodeNumber: episodes.length + 1,
      episodeTitle: '',
      tapeDate: '',
      airDate: '',
      durationMinutes: 45,
      tvRating: 8.5,
      viewersCountMillions: 3.5,
      filmingLocation: 'Mumbai',
      videoUrl: '',
    });
    setIsEpisodeModalOpen(true);
  };

  const handleOpenEditEpisode = (ep: HistoricalEpisode) => {
    setEditingEpisode(ep);
    setEpisodeForm({
      seasonId: ep.seasonId,
      episodeNumber: ep.episodeNumber,
      episodeTitle: ep.episodeTitle ?? '',
      tapeDate: ep.tapeDate ? String(ep.tapeDate).slice(0, 10) : '',
      airDate: ep.airDate ? String(ep.airDate).slice(0, 10) : '',
      durationMinutes: ep.durationMinutes ?? 45,
      tvRating: ep.tvRating ?? null,
      viewersCountMillions: ep.viewersCountMillions ?? null,
      filmingLocation: ep.filmingLocation ?? '',
      videoUrl: ep.videoUrl ?? '',
    });
    setIsEpisodeModalOpen(true);
  };

  const handleSaveEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      if (editingEpisode) {
        await updateHistoricalEpisode(editingEpisode.episodeId, episodeForm);
        setFeedback({ type: 'success', message: `Episode ${episodeForm.episodeNumber} updated successfully.` });
      } else {
        await createHistoricalEpisode(episodeForm);
        setFeedback({ type: 'success', message: `Episode ${episodeForm.episodeNumber} added successfully.` });
      }
      setIsEpisodeModalOpen(false);
      if (selectedSeasonIdForEpisodes) {
        await loadEpisodes(selectedSeasonIdForEpisodes);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save episode.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================================
  // SHARK CRUD HANDLERS
  // ==========================================================================

  const handleOpenAddShark = () => {
    setEditingShark(null);
    setSharkForm({
      displayName: '',
      investmentFirmName: '',
      stageName: '',
      gender: 'Male',
      birthDate: '',
      isGuestShark: false,
    });
    setIsSharkModalOpen(true);
  };

  const handleOpenEditShark = (sh: HistoricalShark) => {
    setEditingShark(sh);
    setSharkForm({
      displayName: sh.displayName,
      investmentFirmName: sh.investmentFirmName ?? '',
      stageName: sh.stageName ?? '',
      gender: sh.gender ?? '',
      birthDate: sh.birthDate ? String(sh.birthDate).slice(0, 10) : '',
      isGuestShark: Boolean(sh.isGuestShark),
    });
    setIsSharkModalOpen(true);
  };

  const handleSaveShark = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      if (editingShark) {
        await updateHistoricalShark(editingShark.sharkId, sharkForm);
        setFeedback({ type: 'success', message: `Shark "${sharkForm.displayName}" updated successfully.` });
      } else {
        await createHistoricalShark(sharkForm);
        setFeedback({ type: 'success', message: `Shark "${sharkForm.displayName}" created successfully.` });
      }
      setIsSharkModalOpen(false);
      await loadSharks();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save shark.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================================
  // DELETE HANDLERS
  // ==========================================================================

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      if (deleteTarget.type === 'season') {
        await deleteHistoricalSeason(deleteTarget.id);
        setFeedback({ type: 'success', message: `Season deleted successfully.` });
        await loadSeasons();
      } else if (deleteTarget.type === 'episode') {
        await deleteHistoricalEpisode(deleteTarget.id);
        setFeedback({ type: 'success', message: `Episode deleted successfully.` });
        if (selectedSeasonIdForEpisodes) await loadEpisodes(selectedSeasonIdForEpisodes);
      } else if (deleteTarget.type === 'shark') {
        await deleteHistoricalShark(deleteTarget.id);
        setFeedback({ type: 'success', message: `Shark deleted successfully.` });
        await loadSharks();
      }
      setDeleteTarget(null);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to delete record.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered lists
  const visibleSeasons = seasons.filter((s) => {
    if (!seasonSearch.trim()) return true;
    const q = seasonSearch.trim().toLowerCase();
    return s.countryFranchise.toLowerCase().includes(q) || String(s.seasonNumber).includes(q);
  });

  const visibleSharks = sharks.filter((sh) => {
    if (!sharkSearch.trim()) return true;
    const q = sharkSearch.trim().toLowerCase();
    return sh.displayName.toLowerCase().includes(q) || (sh.investmentFirmName && sh.investmentFirmName.toLowerCase().includes(q));
  });

  return (
    <div className="historical-manager-container">
      {/* Tab Navigation */}
      <div className="hist-tabs-bar">
        <div className="hist-tabs">
          <button
            type="button"
            className={`hist-tab ${activeTab === 'seasons' ? 'active' : ''}`}
            onClick={() => setActiveTab('seasons')}
          >
            Seasons ({seasons.length})
          </button>
          <button
            type="button"
            className={`hist-tab ${activeTab === 'episodes' ? 'active' : ''}`}
            onClick={() => setActiveTab('episodes')}
          >
            Episodes {selectedSeasonIdForEpisodes ? `(Season ${seasons.find(s => s.seasonId === selectedSeasonIdForEpisodes)?.seasonNumber || ''})` : ''}
          </button>
          <button
            type="button"
            className={`hist-tab ${activeTab === 'sharks' ? 'active' : ''}`}
            onClick={() => setActiveTab('sharks')}
          >
            Sharks Roster ({sharks.length})
          </button>
        </div>

        {/* Action Button */}
        <div className="hist-tab-actions">
          {activeTab === 'seasons' && (
            <button type="button" className="admin-btn admin-btn-primary" onClick={handleOpenAddSeason}>
              + Add Season
            </button>
          )}
          {activeTab === 'episodes' && (
            <button type="button" className="admin-btn admin-btn-primary" onClick={handleOpenAddEpisode} disabled={seasons.length === 0}>
              + Add Episode
            </button>
          )}
          {activeTab === 'sharks' && (
            <button type="button" className="admin-btn admin-btn-primary" onClick={handleOpenAddShark}>
              + Add Shark
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {feedback && (
        <div className={`hist-alert ${feedback.type === 'success' ? 'success' : 'error'}`} role="status">
          <span>{feedback.type === 'success' ? '✓' : '⚠'}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      {error && (
        <div className="hist-alert error" role="alert">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 1: SEASONS */}
      {/* ==================================================================== */}
      {activeTab === 'seasons' && (
        <div className="hist-table-card">
          <div className="hist-table-toolbar">
            <input
              type="search"
              placeholder="Filter seasons by franchise or number…"
              value={seasonSearch}
              onChange={(e) => setSeasonSearch(e.target.value)}
              className="hist-search-input"
            />
            <span className="hist-records-count">{visibleSeasons.length} seasons</span>
          </div>

          {loading ? (
            <div className="hist-state-box">Loading seasons from MySQL…</div>
          ) : visibleSeasons.length === 0 ? (
            <div className="hist-state-box">No seasons found.</div>
          ) : (
            <div className="hist-table-scroll">
              <table className="hist-data-table">
                <thead>
                  <tr>
                    <th>Season #</th>
                    <th>Franchise</th>
                    <th>Premiere</th>
                    <th>Finale</th>
                    <th>Total Eps</th>
                    <th>Stored Eps</th>
                    <th>Network</th>
                    <th>Production</th>
                    <th className="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSeasons.map((s) => (
                    <tr key={s.seasonId}>
                      <td>
                        <strong className="hist-num-badge">S{s.seasonNumber}</strong>
                      </td>
                      <td>{s.countryFranchise}</td>
                      <td>{s.premiereDate ? String(s.premiereDate).slice(0, 10) : '—'}</td>
                      <td>{s.finaleDate ? String(s.finaleDate).slice(0, 10) : '—'}</td>
                      <td>{s.totalEpisodes ?? '—'}</td>
                      <td>{s.storedEpisodeCount ?? 0}</td>
                      <td>{s.networkChannel || '—'}</td>
                      <td>{s.productionHouse || '—'}</td>
                      <td className="td-actions">
                        <button
                          type="button"
                          className="table-action-btn edit"
                          onClick={() => handleOpenEditSeason(s)}
                          title="Edit season"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="table-action-btn delete"
                          onClick={() => setDeleteTarget({ type: 'season', id: s.seasonId, title: `Season ${s.seasonNumber} (${s.countryFranchise})` })}
                          title="Delete season"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: EPISODES */}
      {/* ==================================================================== */}
      {activeTab === 'episodes' && (
        <div className="hist-table-card">
          <div className="hist-table-toolbar">
            <div className="hist-season-picker">
              <label htmlFor="season-select">Select Season:</label>
              <select
                id="season-select"
                value={selectedSeasonIdForEpisodes ?? ''}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedSeasonIdForEpisodes(id);
                  void loadEpisodes(id);
                }}
                className="hist-select"
              >
                {seasons.map((s) => (
                  <option key={s.seasonId} value={s.seasonId}>
                    Season {s.seasonNumber} ({s.countryFranchise})
                  </option>
                ))}
              </select>
            </div>
            <span className="hist-records-count">{episodes.length} episodes loaded</span>
          </div>

          {loading ? (
            <div className="hist-state-box">Loading episodes…</div>
          ) : episodes.length === 0 ? (
            <div className="hist-state-box">
              <p>No episodes recorded for this season yet.</p>
              <button type="button" className="admin-btn admin-btn-ghost" onClick={handleOpenAddEpisode}>
                + Add First Episode
              </button>
            </div>
          ) : (
            <div className="hist-table-scroll">
              <table className="hist-data-table">
                <thead>
                  <tr>
                    <th>Ep #</th>
                    <th>Title</th>
                    <th>Air Date</th>
                    <th>Duration</th>
                    <th>TV Rating</th>
                    <th>Viewers</th>
                    <th>Location</th>
                    <th>Pitches</th>
                    <th className="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {episodes.map((ep) => (
                    <tr key={ep.episodeId}>
                      <td>
                        <strong className="hist-num-badge">E{ep.episodeNumber}</strong>
                      </td>
                      <td>{ep.episodeTitle || `Episode ${ep.episodeNumber}`}</td>
                      <td>{ep.airDate ? String(ep.airDate).slice(0, 10) : '—'}</td>
                      <td>{ep.durationMinutes ? `${ep.durationMinutes}m` : '—'}</td>
                      <td>{ep.tvRating ? `★ ${ep.tvRating}` : '—'}</td>
                      <td>{ep.viewersCountMillions ? `${ep.viewersCountMillions}M` : '—'}</td>
                      <td>{ep.filmingLocation || '—'}</td>
                      <td>{ep.pitchCount ?? 0}</td>
                      <td className="td-actions">
                        <button
                          type="button"
                          className="table-action-btn edit"
                          onClick={() => handleOpenEditEpisode(ep)}
                          title="Edit episode"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="table-action-btn delete"
                          onClick={() => setDeleteTarget({ type: 'episode', id: ep.episodeId, title: `Episode ${ep.episodeNumber}: ${ep.episodeTitle || ''}` })}
                          title="Delete episode"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: SHARKS ROSTER */}
      {/* ==================================================================== */}
      {activeTab === 'sharks' && (
        <div className="hist-table-card">
          <div className="hist-table-toolbar">
            <input
              type="search"
              placeholder="Search Sharks by name or firm…"
              value={sharkSearch}
              onChange={(e) => setSharkSearch(e.target.value)}
              className="hist-search-input"
            />
            <span className="hist-records-count">{visibleSharks.length} sharks</span>
          </div>

          {loading ? (
            <div className="hist-state-box">Loading Sharks roster…</div>
          ) : visibleSharks.length === 0 ? (
            <div className="hist-state-box">No sharks found.</div>
          ) : (
            <div className="hist-table-scroll">
              <table className="hist-data-table">
                <thead>
                  <tr>
                    <th>Shark Name</th>
                    <th>Investment Firm</th>
                    <th>Stage Name</th>
                    <th>Gender</th>
                    <th>Birth Date</th>
                    <th>Status</th>
                    <th>Episodes</th>
                    <th className="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSharks.map((sh) => (
                    <tr key={sh.sharkId}>
                      <td>
                        <strong>{sh.displayName}</strong>
                      </td>
                      <td>{sh.investmentFirmName || 'Independent'}</td>
                      <td>{sh.stageName || '—'}</td>
                      <td>{sh.gender || '—'}</td>
                      <td>{sh.birthDate ? String(sh.birthDate).slice(0, 10) : '—'}</td>
                      <td>
                        <span className={`shark-status-chip ${sh.isGuestShark ? 'guest' : 'regular'}`}>
                          {sh.isGuestShark ? 'Guest Shark' : 'Regular Shark'}
                        </span>
                      </td>
                      <td>{sh.episodeCount ?? 0}</td>
                      <td className="td-actions">
                        <button
                          type="button"
                          className="table-action-btn edit"
                          onClick={() => handleOpenEditShark(sh)}
                          title="Edit shark"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="table-action-btn delete"
                          onClick={() => setDeleteTarget({ type: 'shark', id: sh.sharkId, title: sh.displayName })}
                          title="Delete shark"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT SEASON */}
      {/* ==================================================================== */}
      {isSeasonModalOpen && (
        <div className="hist-modal-overlay" onClick={() => setIsSeasonModalOpen(false)}>
          <div className="hist-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hist-modal-header">
              <h3>{editingSeason ? `Edit Season ${editingSeason.seasonNumber}` : 'Add New Season'}</h3>
              <button type="button" className="hist-modal-close" onClick={() => setIsSeasonModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSaveSeason} className="hist-modal-form">
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="season-num">Season Number *</label>
                  <input
                    id="season-num"
                    type="number"
                    min="1"
                    required
                    value={seasonForm.seasonNumber}
                    onChange={(e) => setSeasonForm({ ...seasonForm, seasonNumber: Number(e.target.value) })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="franchise">Country / Franchise</label>
                  <input
                    id="franchise"
                    type="text"
                    value={seasonForm.countryFranchise}
                    onChange={(e) => setSeasonForm({ ...seasonForm, countryFranchise: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="premiere-date">Premiere Date</label>
                  <input
                    id="premiere-date"
                    type="date"
                    value={seasonForm.premiereDate || ''}
                    onChange={(e) => setSeasonForm({ ...seasonForm, premiereDate: e.target.value || null })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="finale-date">Finale Date</label>
                  <input
                    id="finale-date"
                    type="date"
                    value={seasonForm.finaleDate || ''}
                    onChange={(e) => setSeasonForm({ ...seasonForm, finaleDate: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="total-eps">Total Scheduled Episodes</label>
                  <input
                    id="total-eps"
                    type="number"
                    min="0"
                    value={seasonForm.totalEpisodes || 0}
                    onChange={(e) => setSeasonForm({ ...seasonForm, totalEpisodes: Number(e.target.value) })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="network">Network Channel</label>
                  <input
                    id="network"
                    type="text"
                    value={seasonForm.networkChannel || ''}
                    onChange={(e) => setSeasonForm({ ...seasonForm, networkChannel: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="prod-house">Production House</label>
                <input
                  id="prod-house"
                  type="text"
                  value={seasonForm.productionHouse || ''}
                  onChange={(e) => setSeasonForm({ ...seasonForm, productionHouse: e.target.value })}
                />
              </div>

              <div className="hist-modal-actions">
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setIsSeasonModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save Season'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT EPISODE */}
      {/* ==================================================================== */}
      {isEpisodeModalOpen && (
        <div className="hist-modal-overlay" onClick={() => setIsEpisodeModalOpen(false)}>
          <div className="hist-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hist-modal-header">
              <h3>{editingEpisode ? `Edit Episode ${editingEpisode.episodeNumber}` : 'Add New Episode'}</h3>
              <button type="button" className="hist-modal-close" onClick={() => setIsEpisodeModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSaveEpisode} className="hist-modal-form">
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="ep-season">Season *</label>
                  <select
                    id="ep-season"
                    value={episodeForm.seasonId}
                    onChange={(e) => setEpisodeForm({ ...episodeForm, seasonId: Number(e.target.value) })}
                    disabled={Boolean(editingEpisode)}
                  >
                    {seasons.map((s) => (
                      <option key={s.seasonId} value={s.seasonId}>
                        Season {s.seasonNumber} ({s.countryFranchise})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="ep-num">Episode Number *</label>
                  <input
                    id="ep-num"
                    type="number"
                    min="1"
                    required
                    value={episodeForm.episodeNumber}
                    onChange={(e) => setEpisodeForm({ ...episodeForm, episodeNumber: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="ep-title">Episode Title</label>
                <input
                  id="ep-title"
                  type="text"
                  placeholder="e.g. Season Premiere: Clean Tech & D2C"
                  value={episodeForm.episodeTitle || ''}
                  onChange={(e) => setEpisodeForm({ ...episodeForm, episodeTitle: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="air-date">Air Date</label>
                  <input
                    id="air-date"
                    type="date"
                    value={episodeForm.airDate || ''}
                    onChange={(e) => setEpisodeForm({ ...episodeForm, airDate: e.target.value || null })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="duration-min">Duration (minutes)</label>
                  <input
                    id="duration-min"
                    type="number"
                    min="1"
                    value={episodeForm.durationMinutes || 45}
                    onChange={(e) => setEpisodeForm({ ...episodeForm, durationMinutes: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="tv-rating">TV Rating (0-10)</label>
                  <input
                    id="tv-rating"
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={episodeForm.tvRating || ''}
                    onChange={(e) => setEpisodeForm({ ...episodeForm, tvRating: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="viewers">Viewers (Millions)</label>
                  <input
                    id="viewers"
                    type="number"
                    step="0.1"
                    min="0"
                    value={episodeForm.viewersCountMillions || ''}
                    onChange={(e) => setEpisodeForm({ ...episodeForm, viewersCountMillions: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="filming-loc">Filming Location</label>
                <input
                  id="filming-loc"
                  type="text"
                  placeholder="e.g. Film City, Mumbai"
                  value={episodeForm.filmingLocation || ''}
                  onChange={(e) => setEpisodeForm({ ...episodeForm, filmingLocation: e.target.value })}
                />
              </div>

              <div className="hist-modal-actions">
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setIsEpisodeModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save Episode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT SHARK */}
      {/* ==================================================================== */}
      {isSharkModalOpen && (
        <div className="hist-modal-overlay" onClick={() => setIsSharkModalOpen(false)}>
          <div className="hist-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hist-modal-header">
              <h3>{editingShark ? `Edit Shark: ${editingShark.displayName}` : 'Add Historical Shark'}</h3>
              <button type="button" className="hist-modal-close" onClick={() => setIsSharkModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSaveShark} className="hist-modal-form">
              <div className="form-field">
                <label htmlFor="shark-name">Display Name *</label>
                <input
                  id="shark-name"
                  type="text"
                  required
                  placeholder="e.g. Aman Gupta"
                  value={sharkForm.displayName}
                  onChange={(e) => setSharkForm({ ...sharkForm, displayName: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label htmlFor="shark-firm">Investment Firm / Company</label>
                <input
                  id="shark-firm"
                  type="text"
                  placeholder="e.g. boAt Lifestyle"
                  value={sharkForm.investmentFirmName || ''}
                  onChange={(e) => setSharkForm({ ...sharkForm, investmentFirmName: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="shark-stage-name">Stage Name / Moniker</label>
                  <input
                    id="shark-stage-name"
                    type="text"
                    value={sharkForm.stageName || ''}
                    onChange={(e) => setSharkForm({ ...sharkForm, stageName: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="shark-gender">Gender</label>
                  <select
                    id="shark-gender"
                    value={sharkForm.gender || 'Male'}
                    onChange={(e) => setSharkForm({ ...sharkForm, gender: e.target.value })}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="shark-birth">Birth Date</label>
                  <input
                    id="shark-birth"
                    type="date"
                    value={sharkForm.birthDate || ''}
                    onChange={(e) => setSharkForm({ ...sharkForm, birthDate: e.target.value || null })}
                  />
                </div>
                <div className="form-field checkbox-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={Boolean(sharkForm.isGuestShark)}
                      onChange={(e) => setSharkForm({ ...sharkForm, isGuestShark: e.target.checked })}
                    />
                    <span>Is Guest Shark?</span>
                  </label>
                </div>
              </div>

              <div className="hist-modal-actions">
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setIsSharkModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save Shark'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ==================================================================== */}
      {deleteTarget && (
        <div className="hist-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="hist-modal confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="hist-modal-header">
              <h3>Confirm Deletion</h3>
              <button type="button" className="hist-modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <p className="delete-warning-text">
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>?
            </p>
            <p className="delete-subtext">
              This will permanently remove the record from the database. If this record is referenced by
              existing show episodes or pitches, the deletion will be rejected to protect database integrity.
            </p>

            <div className="hist-modal-actions">
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setDeleteTarget(null)} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="admin-btn admin-btn-danger" onClick={handleConfirmDelete} disabled={submitting}>
                {submitting ? 'Deleting…' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHistoricalManager;
