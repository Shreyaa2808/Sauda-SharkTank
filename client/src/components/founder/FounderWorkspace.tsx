import React, { useState, useEffect, useCallback } from 'react';
import type {
  FounderPitch,
  FounderMetrics,
  CreatePitchPayload,
  MetadataCategories,
} from '../../types/workspace.ts';
import {
  fetchFounderDashboard,
  createFounderPitch,
  updateFounderPitch,
  fetchCategories,
} from '../../services/workspace.ts';
import { formatCurrencyINR } from '../../utils/formatters.ts';
import './FounderWorkspace.css';

export interface FounderWorkspaceProps {
  onNavigateToConnections?: () => void;
  onNavigateToDiscovery?: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();

export const FounderWorkspace: React.FC<FounderWorkspaceProps> = ({
  onNavigateToConnections,
  onNavigateToDiscovery,
}) => {
  const [metrics, setMetrics] = useState<FounderMetrics | null>(null);
  const [pitches, setPitches] = useState<FounderPitch[]>([]);
  const [categories, setCategories] = useState<MetadataCategories>({ industries: [], stages: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Status Filter: 'ALL' | 'DRAFT' | 'SUBMITTED' | 'PUBLISHED' | 'REJECTED'
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPitch, setEditingPitch] = useState<FounderPitch | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [brandName, setBrandName] = useState<string>('');
  const [legalBusinessName, setLegalBusinessName] = useState<string>('');
  const [industryId, setIndustryId] = useState<number>(0);
  const [stageId, setStageId] = useState<number>(0);
  const [businessModel, setBusinessModel] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [foundedYear, setFoundedYear] = useState<string>('');
  const [headquartersCity, setHeadquartersCity] = useState<string>('');
  const [headquartersState, setHeadquartersState] = useState<string>('');
  const [pitchHook, setPitchHook] = useState<string>('');
  const [originalAskAmount, setOriginalAskAmount] = useState<string>('');
  const [originalAskEquityPct, setOriginalAskEquityPct] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashData, catData] = await Promise.all([
        fetchFounderDashboard(),
        fetchCategories(),
      ]);
      setMetrics(dashData.metrics);
      setPitches(dashData.pitches);
      setCategories(catData);
      if (catData.industries.length > 0) {
        setIndustryId((prev) => (prev === 0 ? catData.industries[0].industryId : prev));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Founder Workspace data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function init() {
      try {
        const [dashData, catData] = await Promise.all([
          fetchFounderDashboard(),
          fetchCategories(),
        ]);
        if (!ignore) {
          setMetrics(dashData.metrics);
          setPitches(dashData.pitches);
          setCategories(catData);
          if (catData.industries.length > 0) {
            setIndustryId((prev) => (prev === 0 ? catData.industries[0].industryId : prev));
          }
        }
      } catch (err: any) {
        if (!ignore) {
          setError(err.message || 'Failed to connect to Founder Workspace data.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void init();

    return () => {
      ignore = true;
    };
  }, []);

  const openCreateModal = () => {
    setEditingPitch(null);
    setBrandName('');
    setLegalBusinessName('');
    setIndustryId(categories.industries[0]?.industryId || 1);
    setStageId(categories.stages[0]?.stageId || 1);
    setBusinessModel('');
    setWebsiteUrl('');
    setFoundedYear('');
    setHeadquartersCity('');
    setHeadquartersState('');
    setPitchHook('');
    setOriginalAskAmount('');
    setOriginalAskEquityPct('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (pitch: FounderPitch) => {
    setEditingPitch(pitch);
    setBrandName(pitch.brandName || '');
    setLegalBusinessName(pitch.legalBusinessName || '');
    setIndustryId(pitch.industryId || (categories.industries[0]?.industryId || 1));
    setStageId(pitch.stageId || 0);
    setBusinessModel(pitch.businessModel || '');
    setWebsiteUrl(pitch.websiteUrl || '');
    setFoundedYear(pitch.foundedYear ? String(pitch.foundedYear) : '');
    setHeadquartersCity(pitch.headquartersCity || '');
    setHeadquartersState(pitch.headquartersState || '');
    setPitchHook(pitch.pitchHook || '');
    setOriginalAskAmount(pitch.originalAskAmount ? String(pitch.originalAskAmount) : '');
    setOriginalAskEquityPct(pitch.originalAskEquityPct ? String(pitch.originalAskEquityPct) : '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (targetStatus: 'DRAFT' | 'SUBMITTED') => {
    setFormError(null);

    // Validation
    const cleanBrand = brandName.trim();
    if (!cleanBrand) {
      setFormError('Please enter your venture brand name.');
      return;
    }

    if (!industryId || industryId < 1) {
      setFormError('Please select an industry category.');
      return;
    }

    let askNum: number | null = null;
    if (originalAskAmount.trim()) {
      askNum = Number(originalAskAmount);
      if (isNaN(askNum) || askNum < 0) {
        setFormError('Target investment ask must be a non-negative number.');
        return;
      }
    }

    let equityNum: number | null = null;
    if (originalAskEquityPct.trim()) {
      equityNum = Number(originalAskEquityPct);
      if (isNaN(equityNum) || equityNum < 0.01 || equityNum > 100) {
        setFormError('Equity offered must be between 0.01% and 100%.');
        return;
      }
    }

    let yearNum: number | null = null;
    if (foundedYear.trim()) {
      yearNum = Number(foundedYear);
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear()) {
        setFormError('Please provide a realistic founded year.');
        return;
      }
    }

    const payload: CreatePitchPayload = {
      brandName: cleanBrand,
      legalBusinessName: legalBusinessName.trim() || null,
      industryId,
      stageId: stageId > 0 ? stageId : null,
      businessModel: businessModel.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      foundedYear: yearNum,
      headquartersCity: headquartersCity.trim() || null,
      headquartersState: headquartersState.trim() || null,
      pitchHook: pitchHook.trim() || null,
      originalAskAmount: askNum,
      originalAskEquityPct: equityNum,
      pitchStatus: targetStatus,
    };

    setFormSubmitting(true);
    try {
      if (editingPitch) {
        const res = await updateFounderPitch(editingPitch.pitchId, payload);
        if (res.ok) {
          setIsModalOpen(false);
          await loadData();
        } else {
          setFormError(res.message);
        }
      } else {
        const res = await createFounderPitch(payload);
        if (res.ok) {
          setIsModalOpen(false);
          await loadData();
        } else {
          setFormError(res.message);
        }
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const filteredPitches = pitches.filter((p) => {
    if (filterStatus === 'ALL') return true;
    return p.pitchStatus === filterStatus;
  });

  return (
    <div className="founder-workspace-container">
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
      <div className="founder-header">
        <div className="founder-header-content">
          <div className="founder-crest-label">
            <span className="founder-crest-dot" /> FOUNDER WORKSPACE & VENTURE REGISTRY
          </div>
          <h1 className="founder-title">Manage Your Ventures.</h1>
          <p className="founder-subtitle">
            Build your venture profile, track each pitch’s status, and manage your listings from one workspace.
          </p>
        </div>
        <div className="founder-header-actions">
          {onNavigateToConnections && (
            <button type="button" className="founder-secondary-action-btn" onClick={onNavigateToConnections}>
              Inbound Inquiries →
            </button>
          )}
          <button type="button" className="founder-primary-create-btn" onClick={openCreateModal}>
            + Create a Pitch
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="founder-kpi-ribbon">
        <button type="button" className="founder-kpi-card" aria-pressed={filterStatus === 'ALL'} onClick={() => setFilterStatus('ALL')}>
          <span className="kpi-label">Total Ventures</span>
          <span className="kpi-number">{metrics ? metrics.totalCount : '—'}</span>
          <span className="kpi-sub">Your venture listings</span>
        </button>
        <button type="button" className={`founder-kpi-card ${filterStatus === 'DRAFT' ? 'selected' : ''}`} aria-pressed={filterStatus === 'DRAFT'} onClick={() => setFilterStatus('DRAFT')}>
          <span className="kpi-label">Drafts in Progress</span>
          <span className="kpi-number amber">{metrics ? metrics.draftCount : '—'}</span>
          <span className="kpi-sub">Saved, not yet submitted</span>
        </button>
        <button type="button" className={`founder-kpi-card ${filterStatus === 'SUBMITTED' ? 'selected' : ''}`} aria-pressed={filterStatus === 'SUBMITTED'} onClick={() => setFilterStatus('SUBMITTED')}>
          <span className="kpi-label">Under Review</span>
          <span className="kpi-number blue">{metrics ? metrics.submittedCount : '—'}</span>
          <span className="kpi-sub">Awaiting a registry decision</span>
        </button>
        <button type="button" className={`founder-kpi-card ${filterStatus === 'PUBLISHED' ? 'selected' : ''}`} aria-pressed={filterStatus === 'PUBLISHED'} onClick={() => setFilterStatus('PUBLISHED')}>
          <span className="kpi-label">Live on Platform</span>
          <span className="kpi-number green">{metrics ? metrics.publishedCount : '—'}</span>
          <span className="kpi-sub">Visible in the registry</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="founder-filter-bar">
        <div className="founder-tabs">
          <button
            type="button"
            className={`founder-tab ${filterStatus === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterStatus('ALL')}
          >
            All Ventures ({pitches.length})
          </button>
          <button
            type="button"
            className={`founder-tab ${filterStatus === 'DRAFT' ? 'active' : ''}`}
            onClick={() => setFilterStatus('DRAFT')}
          >
            Drafts ({metrics?.draftCount || 0})
          </button>
          <button
            type="button"
            className={`founder-tab ${filterStatus === 'SUBMITTED' ? 'active' : ''}`}
            onClick={() => setFilterStatus('SUBMITTED')}
          >
            Under Review ({metrics?.submittedCount || 0})
          </button>
          <button
            type="button"
            className={`founder-tab ${filterStatus === 'PUBLISHED' ? 'active' : ''}`}
            onClick={() => setFilterStatus('PUBLISHED')}
          >
            Published ({metrics?.publishedCount || 0})
          </button>
        </div>
      </div>

      {/* Main Content Feed */}
      {loading ? (
        <div className="founder-loading-stage">
          <div className="founder-spinner" />
          <p>Connecting to venture registry...</p>
        </div>
      ) : error ? (
        <div className="founder-error-stage">
          <p className="error-text">⚠️ {error}</p>
          <button type="button" className="founder-retry-btn" onClick={loadData}>
            Retry Connection
          </button>
        </div>
      ) : filteredPitches.length === 0 ? (
        <div className="founder-empty-stage">
          <div className="empty-icon">📁</div>
          <h3>No ventures found in this view.</h3>
          <p>
            {filterStatus === 'ALL'
              ? 'You have not created any startup pitches yet. Get started by drafting your venture proposal.'
              : `You have zero pitches with status "${filterStatus}".`}
          </p>
          <button type="button" className="founder-primary-create-btn" onClick={openCreateModal}>
            + Create Your First Pitch
          </button>
        </div>
      ) : (
        <div className="founder-pitches-grid">
          {filteredPitches.map((pitch) => (
            <div key={pitch.pitchId} className="founder-pitch-card">
              <div className="pitch-card-top">
                <div className="pitch-brand-block">
                  <h3 className="pitch-brand-name">{pitch.brandName}</h3>
                  {pitch.legalBusinessName && (
                    <span className="pitch-legal-name">{pitch.legalBusinessName}</span>
                  )}
                </div>
                <div className={`pitch-status-pill ${pitch.pitchStatus.toLowerCase()}`}>
                  {pitch.pitchStatus === 'SUBMITTED' ? 'Under Review' : pitch.pitchStatus}
                </div>
              </div>

              {pitch.pitchHook && <p className="pitch-hook-preview">{pitch.pitchHook}</p>}

              <div className="pitch-tags-row">
                {pitch.industryName && <span className="pitch-tag">{pitch.industryName}</span>}
                {pitch.stageName && <span className="pitch-tag stage">{pitch.stageName}</span>}
                {pitch.businessModel && <span className="pitch-tag model">{pitch.businessModel}</span>}
                {pitch.headquartersCity && (
                  <span className="pitch-tag location">
                    📍 {pitch.headquartersCity}
                    {pitch.headquartersState ? `, ${pitch.headquartersState}` : ''}
                  </span>
                )}
              </div>

              <div className="pitch-financials-ribbon">
                <div className="financial-cell">
                  <span className="fin-label">Target Funding Ask</span>
                  <span className="fin-val">
                    {pitch.originalAskAmount ? formatCurrencyINR(Number(pitch.originalAskAmount)) : 'Undisclosed'}
                  </span>
                </div>
                <div className="financial-cell">
                  <span className="fin-label">Equity Offered</span>
                  <span className="fin-val">
                    {pitch.originalAskEquityPct ? `${pitch.originalAskEquityPct}%` : 'Undisclosed'}
                  </span>
                </div>
              </div>

              <div className="pitch-card-footer">
                <span className="pitch-timestamp">
                  Registered: {new Date(pitch.submittedAt).toLocaleDateString()}
                </span>
                {pitch.pitchStatus !== 'PUBLISHED' && (
                  <button
                    type="button"
                    className="pitch-edit-btn"
                    onClick={() => openEditModal(pitch)}
                  >
                    Edit Pitch Details ✎
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="pitch-modal-overlay" onClick={() => !formSubmitting && setIsModalOpen(false)}>
          <div className="pitch-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="pitch-modal-header">
              <h2>{editingPitch ? 'Edit Venture Pitch' : 'Create New Startup Pitch'}</h2>
              <button
                type="button"
                className="pitch-modal-close"
                disabled={formSubmitting}
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="pitch-form-error" role="alert">
                ⚠️ {formError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleFormSubmit('SUBMITTED');
              }}
              className="pitch-form-body"
            >
              <div className="form-grid-two">
                <div className="form-field">
                  <label htmlFor="pitch-brand-name">Venture Brand Name *</label>
                  <input
                    id="pitch-brand-name"
                    type="text"
                    required
                    maxLength={150}
                    placeholder="e.g., Aether BioTech"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    disabled={formSubmitting}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pitch-legal-name">Legal Business Name</label>
                  <input
                    id="pitch-legal-name"
                    type="text"
                    maxLength={200}
                    placeholder="e.g., Aether BioTech Private Limited"
                    value={legalBusinessName}
                    onChange={(e) => setLegalBusinessName(e.target.value)}
                    disabled={formSubmitting}
                  />
                </div>
              </div>

              <div className="form-grid-two">
                <div className="form-field">
                  <label htmlFor="pitch-industry">Industry Category *</label>
                  <select
                    id="pitch-industry"
                    required
                    value={industryId}
                    onChange={(e) => setIndustryId(Number(e.target.value))}
                    disabled={formSubmitting}
                  >
                    {categories.industries.map((ind) => (
                      <option key={ind.industryId} value={ind.industryId}>
                        {ind.industryName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="pitch-stage">Funding / Maturity Stage</label>
                  <select
                    id="pitch-stage"
                    value={stageId}
                    onChange={(e) => setStageId(Number(e.target.value))}
                    disabled={formSubmitting}
                  >
                    <option value={0}>Select Stage (Optional)</option>
                    {categories.stages.map((stg) => (
                      <option key={stg.stageId} value={stg.stageId}>
                        {stg.stageName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-two">
                <div className="form-field">
                  <label htmlFor="pitch-ask-amount">Target Investment Ask (₹ INR)</label>
                  <input
                    id="pitch-ask-amount"
                    type="number"
                    min="0"
                    step="10000"
                    placeholder="e.g., 5000000 (50 Lakhs)"
                    value={originalAskAmount}
                    onChange={(e) => setOriginalAskAmount(e.target.value)}
                    disabled={formSubmitting}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pitch-ask-equity">Equity Offered (%)</label>
                  <input
                    id="pitch-ask-equity"
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.1"
                    placeholder="e.g., 5.0"
                    value={originalAskEquityPct}
                    onChange={(e) => setOriginalAskEquityPct(e.target.value)}
                    disabled={formSubmitting}
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="pitch-hook">Executive Summary / Pitch Hook</label>
                <textarea
                  id="pitch-hook"
                  rows={3}
                  maxLength={1000}
                  placeholder="Concise value proposition, proprietary moat, traction benchmarks, and revenue metrics..."
                  value={pitchHook}
                  onChange={(e) => setPitchHook(e.target.value)}
                  disabled={formSubmitting}
                />
              </div>

              <div className="form-grid-three">
                <div className="form-field">
                  <label htmlFor="pitch-model">Business Model</label>
                  <input
                    id="pitch-model"
                    type="text"
                    maxLength={100}
                    placeholder="e.g., B2B SaaS, D2C"
                    value={businessModel}
                    onChange={(e) => setBusinessModel(e.target.value)}
                    disabled={formSubmitting}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pitch-city">City</label>
                  <input
                    id="pitch-city"
                    type="text"
                    maxLength={100}
                    placeholder="e.g., Bengaluru"
                    value={headquartersCity}
                    onChange={(e) => setHeadquartersCity(e.target.value)}
                    disabled={formSubmitting}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pitch-state">State</label>
                  <input
                    id="pitch-state"
                    type="text"
                    maxLength={100}
                    placeholder="e.g., Karnataka"
                    value={headquartersState}
                    onChange={(e) => setHeadquartersState(e.target.value)}
                    disabled={formSubmitting}
                  />
                </div>
              </div>

              <div className="form-grid-two">
                <div className="form-field">
                  <label htmlFor="pitch-url">Website URL</label>
                  <input
                    id="pitch-url"
                    type="url"
                    maxLength={500}
                    placeholder="https://example.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    disabled={formSubmitting}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pitch-founded">Founded Year</label>
                  <input
                    id="pitch-founded"
                    type="number"
                    min="1950"
                    max={CURRENT_YEAR}
                    placeholder="e.g., 2023"
                    value={foundedYear}
                    onChange={(e) => setFoundedYear(e.target.value)}
                    disabled={formSubmitting}
                  />
                </div>
              </div>

              <div className="pitch-modal-actions">
                <button
                  type="button"
                  className="pitch-btn-cancel"
                  disabled={formSubmitting}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pitch-btn-draft"
                  disabled={formSubmitting}
                  onClick={() => handleFormSubmit('DRAFT')}
                >
                  {formSubmitting ? 'Saving...' : 'Save as Draft'}
                </button>
                <button
                  type="submit"
                  className="pitch-btn-submit"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? 'Submitting...' : 'Submit for Review →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
