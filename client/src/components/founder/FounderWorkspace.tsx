import React, { useState, useEffect, useCallback } from 'react';
import type {
  FounderPitch,
  FounderMetrics,
  CreatePitchPayload,
  MetadataCategories,
  FounderReviewEvent,
  FounderProfileData,
} from '../../types/workspace.ts';
import type { AuthUser } from '../../services/auth.ts';
import {
  fetchFounderDashboard,
  createFounderPitch,
  updateFounderPitch,
  archiveFounderPitch,
  fetchFounderProfile,
  updateFounderProfile,
  fetchCategories,
  fetchFounderPitchReviewHistory,
} from '../../services/workspace.ts';
import { formatCurrencyINR } from '../../utils/formatters.ts';
import './FounderWorkspace.css';

export interface FounderWorkspaceProps {
  currentUser?: AuthUser | null;
  onNavigateToConnections?: () => void;
  onNavigateToDiscovery?: () => void;
  onNavigateToInvestor?: () => void;
  onOpenWorkspaces?: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();

type FounderSection = 'overview' | 'pitches' | 'feedback' | 'profile';

export const FounderWorkspace: React.FC<FounderWorkspaceProps> = ({
  onNavigateToConnections,
  onNavigateToDiscovery,
}) => {
  // Navigation & Subviews
  const [activeSection, setActiveSection] = useState<FounderSection>('overview');

  // Dashboard & Pitch Data
  const [metrics, setMetrics] = useState<FounderMetrics | null>(null);
  const [pitches, setPitches] = useState<FounderPitch[]>([]);
  const [categories, setCategories] = useState<MetadataCategories>({ industries: [], stages: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSubmittingId, setActionSubmittingId] = useState<number | null>(null);

  // Status Filter for My Pitches tab
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Pitch Create / Edit Modal State
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

  // Pitch Detail Modal
  const [viewDetailPitch, setViewDetailPitch] = useState<FounderPitch | null>(null);

  // Review Feedback Modal State
  const [reviewHistoryPitch, setReviewHistoryPitch] = useState<FounderPitch | null>(null);
  const [reviewHistory, setReviewHistory] = useState<FounderReviewEvent[]>([]);
  const [reviewHistoryLoading, setReviewHistoryLoading] = useState(false);
  const [reviewHistoryError, setReviewHistoryError] = useState<string | null>(null);

  // Archive Confirmation Modal State
  const [pitchToArchive, setPitchToArchive] = useState<FounderPitch | null>(null);
  const [archiveSubmitting, setArchiveSubmitting] = useState<boolean>(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Founder Profile State
  const [profileData, setProfileData] = useState<FounderProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [profileSaving, setProfileSaving] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Profile Form Fields
  const [pFirstName, setPFirstName] = useState<string>('');
  const [pLastName, setPLastName] = useState<string>('');
  const [pGender, setPGender] = useState<string>('');
  const [pDateOfBirth, setPDateOfBirth] = useState<string>('');
  const [pPhoneNumber, setPPhoneNumber] = useState<string>('');
  const [pHighestEducation, setPHighestEducation] = useState<string>('');
  const [pPriorStartupsCount, setPPriorStartupsCount] = useState<string>('');
  const [pCity, setPCity] = useState<string>('');
  const [pState, setPState] = useState<string>('');
  const [pCountry, setPCountry] = useState<string>('');

  // Load Dashboard Data
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Founder Workspace data.');
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
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to connect to Founder Workspace data.');
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

  // Load Profile when Profile section is selected
  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const p = await fetchFounderProfile();
      setProfileData(p);
      setPFirstName(p.firstName || '');
      setPLastName(p.lastName || '');
      setPGender(p.gender || '');
      setPDateOfBirth(p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '');
      setPPhoneNumber(p.phoneNumber || '');
      setPHighestEducation(p.highestEducation || '');
      setPPriorStartupsCount(p.phoneNumber ? String(p.priorStartupsCount ?? 0) : '');
      setPCity(p.city || '');
      setPState(p.state || '');
      setPCountry(p.phoneNumber ? p.country || '' : '');
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to load founder profile.');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const handleSelectSection = (section: FounderSection) => {
    setActiveSection(section);
    if (section === 'profile' && !profileData && !profileLoading) {
      void loadProfile();
    }
  };

  // Review History Modal
  const openReviewHistory = async (pitch: FounderPitch) => {
    setReviewHistoryPitch(pitch);
    setReviewHistory([]);
    setReviewHistoryError(null);
    setReviewHistoryLoading(true);
    try {
      const history = await fetchFounderPitchReviewHistory(pitch.pitchId);
      setReviewHistory(history);
    } catch (err) {
      setReviewHistoryError(err instanceof Error ? err.message : 'Unable to load review feedback.');
    } finally {
      setReviewHistoryLoading(false);
    }
  };

  const closeReviewHistory = () => {
    setReviewHistoryPitch(null);
    setReviewHistory([]);
    setReviewHistoryError(null);
    setReviewHistoryLoading(false);
  };

  // Keyboard accessibility: Escape to close modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (reviewHistoryPitch) closeReviewHistory();
        if (isModalOpen && !formSubmitting) setIsModalOpen(false);
        if (pitchToArchive && !archiveSubmitting) setPitchToArchive(null);
        if (viewDetailPitch) setViewDetailPitch(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [reviewHistoryPitch, isModalOpen, formSubmitting, pitchToArchive, archiveSubmitting, viewDetailPitch]);

  // Pitch Form Modal Openers
  const openCreateModal = () => {
    setEditingPitch(null);
    setBrandName('');
    setLegalBusinessName('');
    setIndustryId(categories.industries[0]?.industryId || 1);
    setStageId(categories.stages[0]?.stageId || 0);
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

  // Pitch Form Submit
  const handleFormSubmit = async (targetStatus: 'DRAFT' | 'SUBMITTED') => {
    setFormError(null);
    setActionSuccess(null);
    setActionError(null);

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
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > CURRENT_YEAR) {
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
          setActionSuccess(`Venture "${res.pitch.brandName}" updated successfully.`);
          await loadData();
        } else {
          setFormError(res.message);
        }
      } else {
        const res = await createFounderPitch(payload);
        if (res.ok) {
          setIsModalOpen(false);
          setActionSuccess(`New pitch "${res.pitch.brandName}" created in ${targetStatus} status.`);
          await loadData();
        } else {
          setFormError(res.message);
        }
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Direct Status Transitions (Lifecycle)
  const handleSubmitDraft = async (pitch: FounderPitch) => {
    setActionSubmittingId(pitch.pitchId);
    setActionError(null);
    setActionSuccess(null);
    const res = await updateFounderPitch(pitch.pitchId, { pitchStatus: 'SUBMITTED' });
    setActionSubmittingId(null);
    if (res.ok) {
      setActionSuccess(`Venture "${pitch.brandName}" submitted for administrative review.`);
      await loadData();
    } else {
      setActionError(res.message);
    }
  };

  const handleWithdrawSubmission = async (pitch: FounderPitch) => {
    setActionSubmittingId(pitch.pitchId);
    setActionError(null);
    setActionSuccess(null);
    const res = await updateFounderPitch(pitch.pitchId, { pitchStatus: 'DRAFT' });
    setActionSubmittingId(null);
    if (res.ok) {
      setActionSuccess(`Venture "${pitch.brandName}" withdrawn to draft mode. You may edit and resubmit when ready.`);
      await loadData();
    } else {
      setActionError(res.message);
    }
  };

  // Archiving
  const handleConfirmArchive = async () => {
    if (!pitchToArchive) return;
    setArchiveSubmitting(true);
    setArchiveError(null);
    setActionSuccess(null);
    setActionError(null);

    const res = await archiveFounderPitch(pitchToArchive.pitchId);
    setArchiveSubmitting(false);

    if (res.ok) {
      setPitchToArchive(null);
      setActionSuccess(
        `Venture "${pitchToArchive.brandName}" was archived. ${res.summary.withdrawnRequests} pending request(s) withdrawn, ${res.summary.endedConnections} active connection(s) closed.`,
      );
      await loadData();
    } else {
      setArchiveError(res.message);
    }
  };

  // Profile Save
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const missing: string[] = [];
    if (!pFirstName.trim()) missing.push('First name');
    if (!pLastName.trim()) missing.push('Last name');
    if (!pGender.trim()) missing.push('Gender');
    if (!pDateOfBirth.trim()) missing.push('Date of birth');
    if (!pPhoneNumber.trim()) missing.push('Phone number');
    if (!pHighestEducation.trim()) missing.push('Highest education');
    if (pPriorStartupsCount.trim() === '') missing.push('Prior startups founded');
    if (!pCity.trim()) missing.push('City');
    if (!pState.trim()) missing.push('State');
    if (!pCountry.trim()) missing.push('Country');

    if (missing.length > 0) {
      setProfileError(`Please fill in all required details before saving: ${missing.join(', ')}.`);
      return;
    }

    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{5,20}$/;
    if (!phoneRegex.test(pPhoneNumber.trim()) || pPhoneNumber.trim().length > 25) {
      setProfileError('Please provide a valid phone number (e.g. +91 98765 43210).');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(pDateOfBirth.trim())) {
      setProfileError('Date of birth must be a valid YYYY-MM-DD date.');
      return;
    }

    if (pDateOfBirth.trim() > new Date().toISOString().slice(0, 10)) {
      setProfileError('Date of birth cannot be in the future.');
      return;
    }

    const priorCount = Number(pPriorStartupsCount);
    if (!Number.isFinite(priorCount) || priorCount < 0) {
      setProfileError('Prior startups founded must be 0 or more.');
      return;
    }

    setProfileSaving(true);
    const payload: Partial<FounderProfileData> = {
      firstName: pFirstName.trim(),
      lastName: pLastName.trim(),
      gender: pGender.trim(),
      dateOfBirth: pDateOfBirth.trim(),
      phoneNumber: pPhoneNumber.trim(),
      highestEducation: pHighestEducation.trim(),
      priorStartupsCount: Math.floor(priorCount),
      city: pCity.trim(),
      state: pState.trim(),
      country: pCountry.trim(),
    };

    const res = await updateFounderProfile(payload);
    setProfileSaving(false);

    if (res.ok) {
      setProfileData(res.profile);
      setProfileSuccess('Founder profile updated successfully.');
    } else {
      setProfileError(res.message);
    }
  };

  // Filtered Pitches
  const filteredPitches = pitches.filter((p) => {
    if (filterStatus === 'ALL') return true;
    return p.pitchStatus === filterStatus;
  });

  const pitchesNeedingRevision = pitches.filter((p) => p.pitchStatus === 'REJECTED');


  return (
    <div className="founder-workspace-container">
      {/* Top Workspace Navigation & Context Bar */}
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
      <header className="founder-header">
        <div className="founder-header-content">
          <div className="founder-crest-label">
            <span className="founder-crest-dot" /> FOUNDER WORKSPACE · PITCH STUDIO
          </div>
          <h1 className="founder-title">Venture Command.</h1>
          <p className="founder-subtitle">
            Draft, refine, submit, and manage your ventures on the Sauda platform. Monitor moderation status and connect with interested syndicate partners.
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
      </header>

      {/* Navigation Sub-Tabs */}
      <nav className="founder-section-nav" aria-label="Founder Workspace Sections">
        <button
          type="button"
          className={`section-nav-btn ${activeSection === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveSection('overview')}
        >
          <span className="nav-icon" aria-hidden="true">📊</span>
          <span>Overview</span>
        </button>

        <button
          type="button"
          className={`section-nav-btn ${activeSection === 'pitches' ? 'active' : ''}`}
          onClick={() => setActiveSection('pitches')}
        >
          <span className="nav-icon" aria-hidden="true">📁</span>
          <span>My Pitches</span>
          <span className="tab-counter-badge">{pitches.length}</span>
        </button>

        <button
          type="button"
          className={`section-nav-btn ${activeSection === 'feedback' ? 'active' : ''}`}
          onClick={() => setActiveSection('feedback')}
        >
          <span className="nav-icon" aria-hidden="true">⚖</span>
          <span>Review Feedback</span>
          {pitchesNeedingRevision.length > 0 && (
            <span className="tab-counter-badge alert">{pitchesNeedingRevision.length}</span>
          )}
        </button>

        <button
          type="button"
          className={`section-nav-btn ${activeSection === 'profile' ? 'active' : ''}`}
          onClick={() => handleSelectSection('profile')}
        >
          <span className="nav-icon" aria-hidden="true">👤</span>
          <span>Founder Profile</span>
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

      {/* Global Action Success / Error Feedback */}
      {actionSuccess && (
        <div className="founder-feedback-banner success" role="status">
          <span className="feedback-icon" aria-hidden="true">✓</span>
          <p>{actionSuccess}</p>
          <button type="button" className="banner-dismiss-btn" onClick={() => setActionSuccess(null)} aria-label="Dismiss message">×</button>
        </div>
      )}

      {actionError && (
        <div className="founder-feedback-banner error" role="alert">
          <span className="feedback-icon" aria-hidden="true">⚠</span>
          <p>{actionError}</p>
          <button type="button" className="banner-dismiss-btn" onClick={() => setActionError(null)} aria-label="Dismiss error">×</button>
        </div>
      )}

      {/* SECTION 1: OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="founder-overview-section">
          {/* KPI Ribbon */}
          <div className="founder-kpi-ribbon">
            <button
              type="button"
              className="founder-kpi-card"
              onClick={() => {
                setActiveSection('pitches');
                setFilterStatus('ALL');
              }}
            >
              <span className="kpi-label">Total Ventures</span>
              <span className="kpi-number">{metrics ? metrics.totalCount : '—'}</span>
              <span className="kpi-sub">Registered platform pitches</span>
            </button>

            <button
              type="button"
              className="founder-kpi-card"
              onClick={() => {
                setActiveSection('pitches');
                setFilterStatus('DRAFT');
              }}
            >
              <span className="kpi-label">Drafts in Progress</span>
              <span className="kpi-number amber">{metrics ? metrics.draftCount : '—'}</span>
              <span className="kpi-sub">Saved, awaiting submission</span>
            </button>

            <button
              type="button"
              className="founder-kpi-card"
              onClick={() => {
                setActiveSection('pitches');
                setFilterStatus('SUBMITTED');
              }}
            >
              <span className="kpi-label">Under Review</span>
              <span className="kpi-number blue">{metrics ? metrics.submittedCount : '—'}</span>
              <span className="kpi-sub">In administrative queue</span>
            </button>

            <button
              type="button"
              className="founder-kpi-card"
              onClick={() => {
                setActiveSection('pitches');
                setFilterStatus('PUBLISHED');
              }}
            >
              <span className="kpi-label">Live on Platform</span>
              <span className="kpi-number green">{metrics ? metrics.publishedCount : '—'}</span>
              <span className="kpi-sub">Active & searchable</span>
            </button>
          </div>

          {/* Quick Workflow Action Cards */}
          <div className="founder-shortcuts-grid">
            <div className="shortcut-card">
              <div className="shortcut-icon" aria-hidden="true">📝</div>
              <h3>Draft a Venture Pitch</h3>
              <p>Structure your ask, specify valuation parameters, and explain your market proposition.</p>
              <button type="button" className="shortcut-cta-btn" onClick={openCreateModal}>
                + Create Pitch
              </button>
            </div>

            <div className="shortcut-card">
              <div className="shortcut-icon" aria-hidden="true">⚖</div>
              <h3>Review Status & Feedback</h3>
              <p>Read moderation notes, decisions, and reviewer comments for pitches undergoing review.</p>
              <button type="button" className="shortcut-cta-btn" onClick={() => setActiveSection('feedback')}>
                Inspect Feedback →
              </button>
            </div>

            <div className="shortcut-card">
              <div className="shortcut-icon" aria-hidden="true">👤</div>
              <h3>Founder Profile</h3>
              <p>Maintain your professional credentials, education, prior startups count, and contact details.</p>
              <button type="button" className="shortcut-cta-btn" onClick={() => handleSelectSection('profile')}>
                Edit Profile →
              </button>
            </div>

            {onNavigateToConnections && (
              <div className="shortcut-card">
                <div className="shortcut-icon" aria-hidden="true">💬</div>
                <h3>Investor Inquiries</h3>
                <p>Respond to introduction requests from certified investors exploring your venture round.</p>
                <button type="button" className="shortcut-cta-btn" onClick={onNavigateToConnections}>
                  Open Inquiries →
                </button>
              </div>
            )}
          </div>

          {/* Recent Pitch Activity Section */}
          <div className="founder-recent-section">
            <div className="recent-header">
              <h2>Recent Venture Listings</h2>
              <button type="button" className="view-all-link" onClick={() => setActiveSection('pitches')}>
                View all ({pitches.length}) →
              </button>
            </div>

            {loading ? (
              <div className="founder-loading-stage">
                <div className="founder-spinner" />
                <p>Loading venture registry records...</p>
              </div>
            ) : error ? (
              <div className="founder-error-stage">
                <p className="error-text">⚠️ {error}</p>
                <button type="button" className="founder-retry-btn" onClick={loadData}>
                  Retry Connection
                </button>
              </div>
            ) : pitches.length === 0 ? (
              <div className="founder-empty-stage">
                <div className="empty-icon" aria-hidden="true">📁</div>
                <h3>No ventures created yet</h3>
                <p>Draft your first startup pitch to begin syndication on the platform registry.</p>
                <button type="button" className="founder-primary-create-btn" onClick={openCreateModal}>
                  + Create Your First Pitch
                </button>
              </div>
            ) : (
              <div className="recent-pitches-table-wrapper">
                <table className="recent-pitches-table">
                  <thead>
                    <tr>
                      <th>Venture</th>
                      <th>Category</th>
                      <th>Funding Ask</th>
                      <th>Equity</th>
                      <th>Status</th>
                      <th>Registered</th>
                      <th className="align-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pitches.slice(0, 5).map((pitch) => (
                      <tr key={pitch.pitchId}>
                        <td>
                          <strong>{pitch.brandName}</strong>
                          {pitch.legalBusinessName && <span className="cell-sub">{pitch.legalBusinessName}</span>}
                        </td>
                        <td>{pitch.industryName || '—'}</td>
                        <td className="tabular-nums">
                          {pitch.originalAskAmount ? formatCurrencyINR(Number(pitch.originalAskAmount)) : 'Undisclosed'}
                        </td>
                        <td className="tabular-nums">
                          {pitch.originalAskEquityPct ? `${pitch.originalAskEquityPct}%` : '—'}
                        </td>
                        <td>
                          <span className={`pitch-status-pill ${pitch.pitchStatus.toLowerCase()}`}>
                            {pitch.pitchStatus === 'SUBMITTED' ? 'Under Review' : pitch.pitchStatus}
                          </span>
                        </td>
                        <td className="cell-sub">{new Date(pitch.submittedAt).toLocaleDateString()}</td>
                        <td className="align-right">
                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => setViewDetailPitch(pitch)}
                          >
                            Details
                          </button>
                          {pitch.pitchStatus === 'DRAFT' && (
                            <button
                              type="button"
                              className="table-action-btn primary"
                              onClick={() => openEditModal(pitch)}
                            >
                              Edit ✎
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: MY PITCHES */}
      {activeSection === 'pitches' && (
        <div className="founder-pitches-section">
          {/* Status Filter Bar */}
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
              <button
                type="button"
                className={`founder-tab ${filterStatus === 'REJECTED' ? 'active' : ''}`}
                onClick={() => setFilterStatus('REJECTED')}
              >
                Needs Revision ({metrics?.rejectedCount || 0})
              </button>
            </div>
          </div>

          {/* Pitches Grid */}
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
              <div className="empty-icon" aria-hidden="true">📁</div>
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
              {filteredPitches.map((pitch) => {
                const isSubmittingThis = actionSubmittingId === pitch.pitchId;

                return (
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

                    {/* Status Lifecycle Actions */}
                    <div className="pitch-lifecycle-actions">
                      {/* DRAFT ACTIONS */}
                      {pitch.pitchStatus === 'DRAFT' && (
                        <>
                          <button
                            type="button"
                            className="pitch-action-btn submit-btn"
                            disabled={isSubmittingThis}
                            onClick={() => handleSubmitDraft(pitch)}
                          >
                            {isSubmittingThis ? 'Submitting...' : 'Submit for Review →'}
                          </button>
                          <button
                            type="button"
                            className="pitch-action-btn edit-btn"
                            onClick={() => openEditModal(pitch)}
                          >
                            Edit Draft ✎
                          </button>
                          <button
                            type="button"
                            className="pitch-action-btn archive-btn"
                            onClick={() => {
                              setPitchToArchive(pitch);
                              setArchiveError(null);
                            }}
                          >
                            Archive
                          </button>
                        </>
                      )}

                      {/* SUBMITTED (UNDER REVIEW) ACTIONS */}
                      {pitch.pitchStatus === 'SUBMITTED' && (
                        <>
                          <button
                            type="button"
                            className="pitch-action-btn detail-btn"
                            onClick={() => setViewDetailPitch(pitch)}
                          >
                            View Pitch Details
                          </button>
                          <button
                            type="button"
                            className="pitch-action-btn withdraw-btn"
                            disabled={isSubmittingThis}
                            onClick={() => handleWithdrawSubmission(pitch)}
                          >
                            {isSubmittingThis ? 'Withdrawing...' : 'Withdraw to Draft'}
                          </button>
                        </>
                      )}

                      {/* REJECTED ACTIONS */}
                      {pitch.pitchStatus === 'REJECTED' && (
                        <>
                          <button
                            type="button"
                            className="pitch-action-btn feedback-btn"
                            onClick={() => void openReviewHistory(pitch)}
                          >
                            View Feedback ⚖
                          </button>
                          <button
                            type="button"
                            className="pitch-action-btn edit-btn"
                            onClick={() => openEditModal(pitch)}
                          >
                            Edit & Resubmit ✎
                          </button>
                          <button
                            type="button"
                            className="pitch-action-btn archive-btn"
                            onClick={() => {
                              setPitchToArchive(pitch);
                              setArchiveError(null);
                            }}
                          >
                            Archive
                          </button>
                        </>
                      )}

                      {/* PUBLISHED ACTIONS */}
                      {pitch.pitchStatus === 'PUBLISHED' && (
                        <>
                          <button
                            type="button"
                            className="pitch-action-btn detail-btn"
                            onClick={() => setViewDetailPitch(pitch)}
                          >
                            View Live Listing
                          </button>
                          <button
                            type="button"
                            className="pitch-action-btn feedback-btn"
                            onClick={() => void openReviewHistory(pitch)}
                          >
                            Review History
                          </button>
                          <button
                            type="button"
                            className="pitch-action-btn archive-btn"
                            onClick={() => {
                              setPitchToArchive(pitch);
                              setArchiveError(null);
                            }}
                          >
                            Archive Listing
                          </button>
                        </>
                      )}

                      {/* ARCHIVED ACTIONS */}
                      {pitch.pitchStatus === 'ARCHIVED' && (
                        <button
                          type="button"
                          className="pitch-action-btn detail-btn"
                          onClick={() => setViewDetailPitch(pitch)}
                        >
                          View Archived Record
                        </button>
                      )}
                    </div>

                    <div className="pitch-card-footer">
                      <span className="pitch-timestamp">
                        Registered: {new Date(pitch.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: REVIEW FEEDBACK */}
      {activeSection === 'feedback' && (
        <div className="founder-feedback-section">
          <div className="section-intro">
            <h2>Administrative Review & Decision Feedback</h2>
            <p>
              Inspect moderation outcomes and feedback notes recorded by Sauda reviewers. Rejected proposals can be updated and resubmitted directly.
            </p>
          </div>

          {pitches.filter((p) => p.pitchStatus === 'REJECTED' || p.pitchStatus === 'PUBLISHED' || p.pitchStatus === 'SUBMITTED').length === 0 ? (
            <div className="founder-empty-stage">
              <div className="empty-icon" aria-hidden="true">⚖</div>
              <h3>No pitches have been reviewed yet.</h3>
              <p>When you submit a pitch for moderation, decisions and reviewer notes will appear here.</p>
              <button type="button" className="founder-primary-create-btn" onClick={openCreateModal}>
                + Create & Submit Pitch
              </button>
            </div>
          ) : (
            <div className="feedback-pitches-list">
              {pitches
                .filter((p) => p.pitchStatus === 'REJECTED' || p.pitchStatus === 'PUBLISHED' || p.pitchStatus === 'SUBMITTED')
                .map((pitch) => (
                  <div key={pitch.pitchId} className="feedback-card">
                    <div className="feedback-card-header">
                      <div>
                        <h3>{pitch.brandName}</h3>
                        <span className="feedback-meta">
                          {pitch.industryName} · Ask: {pitch.originalAskAmount ? formatCurrencyINR(Number(pitch.originalAskAmount)) : 'Undisclosed'}
                        </span>
                      </div>
                      <div className={`pitch-status-pill ${pitch.pitchStatus.toLowerCase()}`}>
                        {pitch.pitchStatus === 'SUBMITTED' ? 'Under Review' : pitch.pitchStatus}
                      </div>
                    </div>

                    <div className="feedback-card-body">
                      {pitch.pitchStatus === 'SUBMITTED' ? (
                        <p className="pending-notice">
                          ⏳ This venture proposal is currently queued for review by the Sauda moderation committee. You will receive an official decision and note upon completion.
                        </p>
                      ) : (
                        <p className="feedback-prompt">
                          Review history and administrative notes are recorded for this listing.
                        </p>
                      )}
                    </div>

                    <div className="feedback-card-footer">
                      <button
                        type="button"
                        className="founder-secondary-action-btn"
                        onClick={() => void openReviewHistory(pitch)}
                      >
                        Inspect Decision History →
                      </button>
                      {pitch.pitchStatus === 'REJECTED' && (
                        <button
                          type="button"
                          className="founder-primary-create-btn"
                          onClick={() => openEditModal(pitch)}
                        >
                          Edit & Resubmit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: FOUNDER PROFILE */}
      {activeSection === 'profile' && (
        <div className="founder-profile-section">
          <div className="section-intro">
            <h2>Founder Profile & Professional Credentials</h2>
            <p>
              Manage your verified founder background. These details are reviewed by investors alongside your pitch submissions.
            </p>
          </div>

          {profileSuccess && (
            <div className="founder-feedback-banner success" role="status">
              <span className="feedback-icon" aria-hidden="true">✓</span>
              <p>{profileSuccess}</p>
            </div>
          )}

          {profileError && (
            <div className="founder-feedback-banner error" role="alert">
              <span className="feedback-icon" aria-hidden="true">⚠</span>
              <p>{profileError}</p>
            </div>
          )}

          {profileLoading ? (
            <div className="founder-loading-stage">
              <div className="founder-spinner" />
              <p>Loading founder profile...</p>
            </div>
          ) : (
            <form onSubmit={handleProfileSave} autoComplete="off" className="founder-profile-form">
              <div className="form-grid-two">
                <div className="form-field">
                  <label htmlFor="p-first-name">First Name <span className="req">*</span></label>
                  <input
                    id="p-first-name"
                    type="text"
                    placeholder="e.g. Arpita"
                    required
                    maxLength={80}
                    value={pFirstName}
                    onChange={(e) => setPFirstName(e.target.value)}
                    disabled={profileSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="p-last-name">Last Name <span className="req">*</span></label>
                  <input
                    id="p-last-name"
                    type="text"
                    placeholder="e.g. Sharma"
                    maxLength={80}
                    value={pLastName}
                    onChange={(e) => setPLastName(e.target.value)}
                    required
                    disabled={profileSaving}
                  />
                </div>
              </div>

              <div className="form-grid-three">
                <div className="form-field">
                  <label htmlFor="p-gender">Gender <span className="req">*</span></label>
                  <input
                    id="p-gender"
                    type="text"
                    maxLength={30}
                    placeholder="e.g. Female, Male, Non-binary"
                    value={pGender}
                    onChange={(e) => setPGender(e.target.value)}
                    required
                    disabled={profileSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="p-dob">Date of Birth <span className="req">*</span></label>
                  <input
                    id="p-dob"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={pDateOfBirth}
                    onChange={(e) => setPDateOfBirth(e.target.value)}
                    required
                    disabled={profileSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="p-phone">Phone Number <span className="req">*</span></label>
                  <input
                    id="p-phone"
                    type="tel"
                    maxLength={25}
                    placeholder="+91 98765 43210"
                    value={pPhoneNumber}
                    onChange={(e) => setPPhoneNumber(e.target.value)}
                    required
                    disabled={profileSaving}
                  />
                </div>
              </div>

              <div className="form-grid-two">
                <div className="form-field">
                  <label htmlFor="p-education">Highest Education <span className="req">*</span></label>
                  <input
                    id="p-education"
                    type="text"
                    maxLength={120}
                    placeholder="e.g. B.Tech Computer Science, MBA"
                    value={pHighestEducation}
                    onChange={(e) => setPHighestEducation(e.target.value)}
                    required
                    disabled={profileSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="p-prior-startups">Prior Startups Founded <span className="req">*</span></label>
                  <input
                    id="p-prior-startups"
                    type="number"
                    placeholder="e.g. 0"
                    min="0"
                    step="1"
                    value={pPriorStartupsCount}
                    onChange={(e) => setPPriorStartupsCount(e.target.value)}
                    required
                    disabled={profileSaving}
                  />
                </div>
              </div>

              <div className="form-grid-three">
                <div className="form-field">
                  <label htmlFor="p-city">City <span className="req">*</span></label>
                  <input
                    id="p-city"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Mumbai"
                    value={pCity}
                    onChange={(e) => setPCity(e.target.value)}
                    required
                    disabled={profileSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="p-state">State <span className="req">*</span></label>
                  <input
                    id="p-state"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Maharashtra"
                    value={pState}
                    onChange={(e) => setPState(e.target.value)}
                    required
                    disabled={profileSaving}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="p-country">Country <span className="req">*</span></label>
                  <input
                    id="p-country"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. India"
                    value={pCountry}
                    onChange={(e) => setPCountry(e.target.value)}
                    required
                    disabled={profileSaving}
                  />
                </div>
              </div>

              <div className="profile-form-actions">
                <button
                  type="submit"
                  className="founder-primary-create-btn"
                  disabled={profileSaving}
                >
                  {profileSaving ? 'Saving Profile...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Pitch Detail Inspection Modal */}
      {viewDetailPitch && (
        <div className="pitch-modal-overlay" onClick={() => setViewDetailPitch(null)}>
          <div className="pitch-modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="view-pitch-title">
            <div className="pitch-modal-header">
              <div>
                <span className="founder-crest-label">VENTURE LISTING DETAILS</span>
                <h2 id="view-pitch-title">{viewDetailPitch.brandName}</h2>
                {viewDetailPitch.legalBusinessName && (
                  <span className="pitch-legal-name">{viewDetailPitch.legalBusinessName}</span>
                )}
              </div>
              <button
                type="button"
                className="pitch-modal-close"
                onClick={() => setViewDetailPitch(null)}
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            <div className="view-pitch-body">
              <div className={`pitch-status-pill ${viewDetailPitch.pitchStatus.toLowerCase()}`} style={{ marginBottom: '16px' }}>
                Status: {viewDetailPitch.pitchStatus}
              </div>

              {viewDetailPitch.pitchHook && (
                <div className="detail-section">
                  <h4>Pitch Hook / Executive Summary</h4>
                  <p>{viewDetailPitch.pitchHook}</p>
                </div>
              )}

              <div className="detail-grid">
                <div>
                  <span className="detail-label">Industry Category</span>
                  <strong>{viewDetailPitch.industryName || '—'}</strong>
                </div>
                <div>
                  <span className="detail-label">Startup Stage</span>
                  <strong>{viewDetailPitch.stageName || '—'}</strong>
                </div>
                <div>
                  <span className="detail-label">Business Model</span>
                  <strong>{viewDetailPitch.businessModel || '—'}</strong>
                </div>
                <div>
                  <span className="detail-label">Location</span>
                  <strong>
                    {[viewDetailPitch.headquartersCity, viewDetailPitch.headquartersState, viewDetailPitch.headquartersCountry]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </strong>
                </div>
                <div>
                  <span className="detail-label">Funding Ask</span>
                  <strong>
                    {viewDetailPitch.originalAskAmount ? formatCurrencyINR(Number(viewDetailPitch.originalAskAmount)) : 'Undisclosed'}
                  </strong>
                </div>
                <div>
                  <span className="detail-label">Equity Offered</span>
                  <strong>{viewDetailPitch.originalAskEquityPct ? `${viewDetailPitch.originalAskEquityPct}%` : 'Undisclosed'}</strong>
                </div>
                <div>
                  <span className="detail-label">Website URL</span>
                  <strong>{viewDetailPitch.websiteUrl ? <a href={viewDetailPitch.websiteUrl} target="_blank" rel="noopener noreferrer">{viewDetailPitch.websiteUrl}</a> : '—'}</strong>
                </div>
                <div>
                  <span className="detail-label">Founded Year</span>
                  <strong>{viewDetailPitch.foundedYear || '—'}</strong>
                </div>
              </div>
            </div>

            <div className="pitch-modal-actions">
              <button
                type="button"
                className="pitch-btn-cancel"
                onClick={() => setViewDetailPitch(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Feedback Timeline Modal */}
      {reviewHistoryPitch && (
        <div className="founder-review-modal-overlay" role="presentation" onClick={closeReviewHistory}>
          <section
            className="founder-review-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="founder-review-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="founder-review-modal-header">
              <div>
                <span className="founder-crest-label">PITCH REVIEW HISTORY</span>
                <h2 id="founder-review-modal-title">{reviewHistoryPitch.brandName}</h2>
              </div>
              <button type="button" className="founder-review-modal-close" onClick={closeReviewHistory} aria-label="Close review history">×</button>
            </div>
            <p className="founder-review-modal-intro">
              Read decisions and feedback recorded by Sauda reviewers. You can edit and resubmit a rejected pitch using the pitch editor.
            </p>
            {reviewHistoryLoading ? (
              <div className="founder-review-modal-state" role="status">Loading review history…</div>
            ) : reviewHistoryError ? (
              <div className="founder-review-modal-error" role="alert">{reviewHistoryError}</div>
            ) : reviewHistory.length === 0 ? (
              <div className="founder-review-modal-state">No review events are available for this pitch yet.</div>
            ) : (
              <ol className="founder-review-timeline">
                {reviewHistory.map((event) => (
                  <li key={event.reviewEventId}>
                    <div className="founder-review-timeline-top">
                      <strong className={event.decision === 'REJECT' ? 'rejected' : 'published'}>
                        {event.decision === 'REJECT' ? 'Rejected' : 'Published'}
                      </strong>
                      <time dateTime={event.decidedAt}>{new Date(event.decidedAt).toLocaleString()}</time>
                    </div>
                    <span className="founder-review-timeline-reviewer">Reviewed by {event.reviewerName}</span>
                    {event.reviewNote ? (
                      <p>{event.reviewNote}</p>
                    ) : (
                      <p className="founder-review-no-note">No additional note was provided.</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <div className="founder-review-modal-actions">
              {reviewHistoryPitch.pitchStatus === 'REJECTED' && (
                <button
                  type="button"
                  className="founder-primary-create-btn"
                  onClick={() => {
                    const pitch = reviewHistoryPitch;
                    closeReviewHistory();
                    openEditModal(pitch);
                  }}
                >
                  Edit and Resubmit
                </button>
              )}
              <button type="button" className="founder-secondary-action-btn" onClick={closeReviewHistory}>Close</button>
            </div>
          </section>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {pitchToArchive && (
        <div
          className="modal-overlay-danger"
          onClick={() => !archiveSubmitting && setPitchToArchive(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-pitch-title"
        >
          <div className="modal-panel-danger" onClick={(e) => e.stopPropagation()}>
            <h3 id="archive-pitch-title">Archive Venture Listing?</h3>
            <p>
              Archiving <strong>{pitchToArchive.brandName}</strong> will permanently remove it from the active platform registry. Any pending investor connection requests will be automatically withdrawn, and active conversations will be closed in read-only mode.
            </p>
            <p className="archive-warning-note">
              This action cannot be undone. You will retain access to historical messages in read-only mode.
            </p>

            {archiveError && (
              <div className="pitch-form-error" role="alert">
                ⚠️ {archiveError}
              </div>
            )}

            <div className="modal-danger-actions">
              <button
                type="button"
                className="btn-cancel"
                disabled={archiveSubmitting}
                onClick={() => setPitchToArchive(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-confirm-end"
                disabled={archiveSubmitting}
                onClick={handleConfirmArchive}
              >
                {archiveSubmitting ? 'Archiving...' : 'Yes, Archive Listing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Pitch Modal */}
      {isModalOpen && (
        <div className="pitch-modal-overlay" onClick={() => !formSubmitting && setIsModalOpen(false)}>
          <div className="pitch-modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="form-modal-title">
            <div className="pitch-modal-header">
              <h2 id="form-modal-title">{editingPitch ? 'Edit Venture Pitch' : 'Create New Startup Pitch'}</h2>
              <button
                type="button"
                className="pitch-modal-close"
                disabled={formSubmitting}
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
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
                    placeholder="e.g., Nexus Robotics"
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
                    placeholder="e.g., Nexus Innovations Pvt. Ltd."
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
                  <label htmlFor="pitch-stage">Startup Stage</label>
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