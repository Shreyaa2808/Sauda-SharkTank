import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import {
  CinematicIntro,
  INTRO_SESSION_STORAGE_KEY,
} from './components/intro/CinematicIntro.tsx';
import { SaudaLoader } from './components/loader/SaudaLoader.tsx';
import { LoginPage } from './components/auth/LoginPage.tsx';
import { AccountMenu } from './components/auth/AccountMenu.tsx';
import { ProfilePage } from './components/profile/ProfilePage.tsx';
import { AccountSettingsPage } from './components/settings/AccountSettingsPage.tsx';
import { WorkspaceChooserModal } from './components/workspace/WorkspaceChooserModal.tsx';
import { WorkspaceGate } from './components/workspace/WorkspaceGate.tsx';
import { FounderWorkspace } from './components/founder/FounderWorkspace.tsx';
import { InvestorWorkspace } from './components/investor/InvestorWorkspace.tsx';
import { ConnectionsHub } from './components/connections/ConnectionsHub.tsx';
import { StartupDetailModal } from './components/startup/StartupDetailModal.tsx';
import { ComparisonTray } from './components/compare/ComparisonTray.tsx';
import { ComparisonMatrix } from './components/compare/ComparisonMatrix.tsx';
import { fetchStartups } from './services/api.ts';
import { checkSession, logout, type AuthUser } from './services/auth.ts';
import type { PitchType, Startup } from './types/startup.ts';
import {
  formatCurrency,
  formatEquity,
  formatPitchNumber,
  formatStageName,
} from './utils/formatters.ts';

type FilterType = 'ALL' | PitchType;
type AppRoute = 'discovery' | 'login' | 'profile' | 'settings' | 'founder' | 'investor' | 'connections';

// Single source of truth for the (History API based) route model.
const ROUTE_PATHS: Record<AppRoute, string> = {
  discovery: '/',
  login: '/login',
  profile: '/profile',
  settings: '/settings',
  founder: '/founder',
  investor: '/investor',
  connections: '/connections',
};

// Routes that need a server-verified session. Role checks for workspaces are layered on top.
const AUTH_REQUIRED_ROUTES: AppRoute[] = ['profile', 'settings', 'founder', 'investor', 'connections'];
const WORKSPACE_ROUTES: AppRoute[] = ['founder', 'investor', 'connections'];

const pathToRoute = (rawPath: string): AppRoute => {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
  const match = (Object.keys(ROUTE_PATHS) as AppRoute[]).find((r) => ROUTE_PATHS[r] === path);
  return match ?? 'discovery';
};

const getInitialRoute = (): AppRoute => {
  if (typeof window === 'undefined') return 'discovery';
  return pathToRoute(window.location.pathname);
};

const checkIntroEligible = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const alreadyStarted = sessionStorage.getItem(INTRO_SESSION_STORAGE_KEY);
    if (alreadyStarted) {
      return false;
    }
    // Mark as started immediately so refreshing midway through does not replay it
    sessionStorage.setItem(INTRO_SESSION_STORAGE_KEY, 'true');
    return true;
  } catch {
    return false;
  }
};

export const App: React.FC = () => {
  const [startups, setStartups] = useState<Startup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [reloadKey, setReloadKey] = useState<number>(0);

  // Cinematic Intro State: plays only once per browser tab session
  const [introActive, setIntroActive] = useState<boolean>(checkIntroEligible);

  // Initial application bootstrap completion states
  const [isInitialAuthDone, setIsInitialAuthDone] = useState<boolean>(false);
  const [isInitialDataDone, setIsInitialDataDone] = useState<boolean>(false);

  // Authentication & Access Routing State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [requestedRoute, setRequestedRoute] = useState<AppRoute>(getInitialRoute);
  // Workspace Chooser Modal State
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState<boolean>(false);

  // Detail Modal & Comparison Matrix States
  const [selectedDetailStartup, setSelectedDetailStartup] = useState<Startup | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<Startup[]>([]);
  const [isMatrixOpen, setIsMatrixOpen] = useState<boolean>(false);
  const [compareWarning, setCompareWarning] = useState<string | null>(null);

  // Navigation helper synchronized with browser History API.
  // `replace` is used for guard redirects so Back never lands on a page the guard just rejected.
  const navigateTo = useCallback((route: AppRoute, replace = false) => {
    setRequestedRoute(route);
    const path = ROUTE_PATHS[route];
    if (window.location.pathname !== path) {
      if (replace) window.history.replaceState(null, '', path);
      else window.history.pushState(null, '', path);
    }
    window.scrollTo?.({ top: 0 });
  }, []);

  // Route to resume after a guard-triggered sign-in (never trusted for authorization).
  const returnToRef = React.useRef<AppRoute | null>(null);

  // Synchronize browser back/forward buttons with currentRoute
  useEffect(() => {
    const handlePopState = () => {
      setRequestedRoute(pathToRoute(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check authenticated session cookie on mount (server is the source of truth for identity + roles)
  useEffect(() => {
    let mounted = true;
    checkSession()
      .then((session) => {
        if (!mounted) return;
        setCurrentUser(session.authenticated && session.user ? session.user : null);
      })
      .catch(() => {
        if (mounted) setCurrentUser(null);
      })
      .finally(() => {
        if (mounted) setIsInitialAuthDone(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const currentUserRef = React.useRef<AuthUser | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Route guard: derived during render so direct URL entry, refresh, Back/Forward and logout
  // can never display a protected view without a server-verified session.
  const guardRedirect: AppRoute | null = !isInitialAuthDone
    ? null
    : !currentUser && AUTH_REQUIRED_ROUTES.includes(requestedRoute)
      ? 'login'
      : currentUser && requestedRoute === 'login'
        ? 'discovery'
        : null;
  const currentRoute: AppRoute = guardRedirect ?? requestedRoute;

  // Keep the address bar in step with a guard redirect (history only; no state updates here).
  useEffect(() => {
    if (!guardRedirect) return;
    if (guardRedirect === 'login') returnToRef.current = requestedRoute;
    const path = ROUTE_PATHS[guardRedirect];
    if (window.location.pathname !== path) window.history.replaceState(null, '', path);
  }, [guardRedirect, requestedRoute]);

  // Re-verify roles with the server whenever a workspace route is entered, so a stale
  // client-side role list (e.g. activated or revoked in another tab) never decides access.
  const currentUserId = currentUser?.userId ?? null;
  useEffect(() => {
    if (currentUserId === null || !WORKSPACE_ROUTES.includes(currentRoute)) return;
    const controller = new AbortController();
    checkSession(controller.signal)
      .then((session) => {
        if (controller.signal.aborted) return;
        if (!session.authenticated || !session.user) {
          setCurrentUser(null);
          return;
        }
        const fresh = session.user;
        setCurrentUser((prev) => {
          if (!prev || prev.userId !== fresh.userId) return prev;
          const same =
            prev.roles.length === fresh.roles.length && prev.roles.every((r) => fresh.roles.includes(r));
          return same ? prev : { ...prev, roles: fresh.roles };
        });
      })
      .catch(() => {
        /* aborted or offline: keep current state; backend still enforces authorization */
      });
    return () => controller.abort();
  }, [currentRoute, currentUserId]);

  const hasRole = (role: string): boolean => Boolean(currentUser?.roles.includes(role));

  // Initial app bootstrap is pending when auth session is unresolved OR
  // (if on discovery route, initial startup data is still loading without error)
  const isBootstrapPending =
    !isInitialAuthDone || (currentRoute === 'discovery' && !isInitialDataDone && !error);

  // Show the dedicated SaudaLoader during refresh / initial bootstrap when intro is NOT playing
  const showBootstrapLoader = !introActive && isBootstrapPending;

  // Transition handler when cinematic intro completes
  const handleIntroComplete = () => {
    setIntroActive(false);
    try {
      sessionStorage.setItem(INTRO_SESSION_STORAGE_KEY, 'true');
    } catch {
      // Ignore if sessionStorage is restricted
    }
    // Signed-out visitors land on the login page (guest entry is offered there);
    // signed-in users continue to the URL they requested. Guards enforce the rest.
    if (!currentUserRef.current) {
      navigateTo('login', true);
    } else {
      navigateTo(pathToRoute(window.location.pathname), true);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    await logout();
    returnToRef.current = null;
    setIsWorkspaceModalOpen(false);
    setCurrentUser(null);
    navigateTo('login');
  };

  // Login success handler: resume the originally requested route when there was one
  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    const resume = returnToRef.current;
    returnToRef.current = null;
    navigateTo(resume ?? 'discovery');
  };

  const gateProps = {
    isSignedIn: Boolean(currentUser),
    onSignIn: () => navigateTo('login'),
    onOpenWorkspaces: () => setIsWorkspaceModalOpen(true),
    onReturnToDiscovery: () => navigateTo('discovery'),
  };

  // Load real published startup pitches from backend API
  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setLoading(true);
      setError('');

      try {
        const response = await fetchStartups(50, controller.signal);
        setStartups(response.data);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(
          'Could not connect to the Sauda startup database. Check that the backend server is running at localhost:4000.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setIsInitialDataDone(true);
        }
      }
    }

    void loadData();

    return () => controller.abort();
  }, [reloadKey]);

  // Client-side search and filtering across 8 factual attributes
  const visibleStartups = useMemo(() => {
    const query = search.trim().toLowerCase();

    return startups.filter((startup) => {
      const matchesType = filter === 'ALL' || startup.pitchType === filter;

      const searchableString = [
        startup.brandName,
        startup.legalBusinessName,
        startup.industry,
        startup.startupStage,
        startup.businessModel,
        startup.headquartersCity,
        startup.headquartersState,
        startup.headquartersCountry,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesType && (!query || searchableString.includes(query));
    });
  }, [startups, search, filter]);

  // Telemetry Aggregates for Modern Finance Hero Ribbon
  const metrics = useMemo(() => {
    const totalCount = startups.length;
    const showCount = startups.filter((s) => s.pitchType === 'SHOW').length;
    const platformCount = startups.filter((s) => s.pitchType === 'PLATFORM').length;
    const totalAsk = startups.reduce((acc, s) => acc + (Number(s.originalAskAmount) || 0), 0);
    const avgEquity =
      totalCount > 0
        ? startups.reduce((acc, s) => acc + (Number(s.originalAskEquityPct) || 0), 0) / totalCount
        : 0;

    return {
      totalCount,
      showCount,
      platformCount,
      totalAsk,
      avgEquity,
    };
  }, [startups]);

  const handleClearFilters = () => {
    setSearch('');
    setFilter('ALL');
  };

  const scrollToExplorer = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById('explorer');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Toggle startup in comparison selection (max 3, must match pitchType)
  const handleToggleCompare = (startup: Startup) => {
    setCompareWarning(null);
    const isSelected = selectedForCompare.some((s) => s.pitchId === startup.pitchId);
    if (isSelected) {
      setSelectedForCompare((prev) => prev.filter((s) => s.pitchId !== startup.pitchId));
      return;
    }

    // Ensure comparison is within the same pitchType
    if (selectedForCompare.length > 0 && selectedForCompare[0].pitchType !== startup.pitchType) {
      const existingCategory =
        selectedForCompare[0].pitchType === 'PLATFORM' ? 'Platform Listings' : 'Shark Tank Show Pitches';
      setCompareWarning(`You can only compare ventures within the same category (${existingCategory}).`);
      return;
    }

    // Maximum 3 ventures
    if (selectedForCompare.length >= 3) {
      setCompareWarning('You can compare a maximum of 3 ventures simultaneously.');
      return;
    }

    setSelectedForCompare((prev) => [...prev, startup]);
  };

  const handleRemoveCompare = (pitchId: number) => {
    setSelectedForCompare((prev) => prev.filter((s) => s.pitchId !== pitchId));
    if (selectedForCompare.length <= 1) {
      setIsMatrixOpen(false);
    }
  };

  const handleClearCompare = () => {
    setSelectedForCompare([]);
    setIsMatrixOpen(false);
    setCompareWarning(null);
  };

  // If current route is login, render the dedicated LoginPage experience
  if (currentRoute === 'login') {
    return (
      <>
        {introActive && (
          <CinematicIntro onComplete={handleIntroComplete} />
        )}
        {showBootstrapLoader && (
          <SaudaLoader message="INITIALIZING IDENTITY SERVICES" />
        )}
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onBrowseAsGuest={() => navigateTo('discovery')}
        />
      </>
    );
  }

  return (
    <main className="app-shell">
      {/* 0. CINEMATIC SHARK VIDEO INTRO OVERLAY */}
      {introActive && (
        <CinematicIntro onComplete={handleIntroComplete} />
      )}

      {/* 0.1 PREMIUM REFRESH / BOOTSTRAP LOADER */}
      {showBootstrapLoader && (
        <SaudaLoader message="SYNCHRONIZING VENTURE INTELLIGENCE" />
      )}

      {/* 1. DARK NAVY NAVIGATION HEADER */}
      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigateTo('discovery');
          }}
          aria-label="Sauda Home"
        >
          <div className="brand-crest" aria-hidden="true">
            <svg viewBox="0 0 36 36" fill="none" width="22" height="22">
              <path
                d="M18 2 L32 7 V18 C32 26 26 32 18 35 C10 32 4 26 4 18 V7 L18 2 Z"
                fill="#0A1929"
                stroke="#C3A064"
                strokeWidth="1.5"
              />
              <path
                d="M12 24 C14 24 16 22 17 19 C18 15 19 10 24 9 C22 13 22 18 25 21 C22 22 18 24 12 24 Z"
                fill="#C3A064"
              />
            </svg>
          </div>
          <div className="brand-copy">
            <strong>
              sauda<span>.</span>
            </strong>
            <small>THE STARTUP EXCHANGE</small>
          </div>
        </a>

        <nav className="topbar-nav" aria-label="Primary navigation">
          <a
            className={`nav-link ${currentRoute === 'discovery' ? 'active' : ''}`}
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('discovery');
            }}
          >
            Discover
          </a>
          <a
            className="nav-link"
            href="#explorer"
            onClick={(e) => {
              if (currentRoute !== 'discovery') {
                e.preventDefault();
                navigateTo('discovery');
                setTimeout(() => {
                  const el = document.getElementById('explorer');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              } else {
                scrollToExplorer(e);
              }
            }}
          >
            Startup Explorer
          </a>
          {currentUser && hasRole('FOUNDER') && (
            <a
              className={`nav-link ${currentRoute === 'founder' ? 'active' : ''}`}
              href="/founder"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('founder');
              }}
              aria-current={currentRoute === 'founder' ? 'page' : undefined}
            >
              Founder
            </a>
          )}
          {currentUser && hasRole('INVESTOR') && (
            <a
              className={`nav-link ${currentRoute === 'investor' ? 'active' : ''}`}
              href="/investor"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('investor');
              }}
              aria-current={currentRoute === 'investor' ? 'page' : undefined}
            >
              Deal Room
            </a>
          )}
          {currentUser && (hasRole('FOUNDER') || hasRole('INVESTOR')) && (
            <a
              className={`nav-link ${currentRoute === 'connections' ? 'active' : ''}`}
              href="/connections"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('connections');
              }}
              aria-current={currentRoute === 'connections' ? 'page' : undefined}
            >
              Connections
            </a>
          )}
        </nav>

        <div className="topbar-right">
          {/* Real Authentication State: Account Menu or Sign In CTA */}
          {currentUser && (
            <button
              type="button"
              className="topbar-workspace-btn"
              onClick={() => setIsWorkspaceModalOpen(true)}
              aria-haspopup="dialog"
              title="Switch or activate a workspace"
            >
              <span aria-hidden="true">▦</span>
              <span>Workspaces</span>
            </button>
          )}
          {currentUser ? (
            <AccountMenu
              user={currentUser}
              onNavigate={(route) => navigateTo(route)}
              onOpenWorkspaces={() => setIsWorkspaceModalOpen(true)}
              onLogout={handleLogout}
            />
          ) : (
            <button
              type="button"
              className="topbar-signin-btn"
              onClick={() => navigateTo('login')}
              title="Sign in with your Google account"
              aria-label="Sign in"
            >
              <span>Sign In</span>
              <span aria-hidden="true">→</span>
            </button>
          )}

          {/* API Connectivity Indicator */}
          <div
            className="connection-pill"
            role="status"
            aria-live="polite"
            title={error ? 'API disconnected' : 'Connected to live database'}
          >
            <span
              className={`connection-indicator ${error ? 'offline' : ''}`}
            />
            <span className="connection-text">
              {loading ? 'CONNECTING' : error ? 'OFFLINE' : 'LIVE REGISTRY'}
            </span>
          </div>
        </div>
      </header>

      {/* 2. DYNAMIC ROUTE VIEWS: PROFILE, SETTINGS, WORKSPACES (guarded), OR DISCOVERY */}
      {currentRoute === 'profile' && currentUser && (
        <ProfilePage
          currentUser={currentUser}
          onNavigate={navigateTo}
          onProfileUpdated={(updated) => {
            setCurrentUser((prev) => (prev ? { ...prev, fullName: updated.fullName } : null));
          }}
        />
      )}

      {currentRoute === 'settings' && currentUser && (
        <AccountSettingsPage
          currentUser={currentUser}
          onNavigate={navigateTo}
          onSignOut={handleLogout}
        />
      )}

      {/* Workspace routes: rendered only once the server session has resolved. The role check
          here is a UX guard; every workspace API call is independently authorized by the backend. */}
      {isInitialAuthDone && currentRoute === 'founder' && (
        currentUser && hasRole('FOUNDER') ? (
          <FounderWorkspace
            onNavigateToConnections={() => navigateTo('connections')}
            onNavigateToDiscovery={() => navigateTo('discovery')}
          />
        ) : (
          <WorkspaceGate {...gateProps} kind="founder" />
        )
      )}

      {isInitialAuthDone && currentRoute === 'investor' && (
        currentUser && hasRole('INVESTOR') ? (
          <InvestorWorkspace
            onNavigateToConnections={() => navigateTo('connections')}
            onNavigateToDiscovery={() => navigateTo('discovery')}
          />
        ) : (
          <WorkspaceGate {...gateProps} kind="investor" />
        )
      )}

      {isInitialAuthDone && currentRoute === 'connections' && (
        currentUser && (hasRole('FOUNDER') || hasRole('INVESTOR')) ? (
          <ConnectionsHub
            currentUser={currentUser}
            onNavigateToDiscovery={() => navigateTo('discovery')}
          />
        ) : (
          <WorkspaceGate {...gateProps} kind="connections" />
        )
      )}

      {/* WORKSPACE CHOOSER MODAL */}
      {isWorkspaceModalOpen && (
        <WorkspaceChooserModal
          currentUser={currentUser}
          isOpen={isWorkspaceModalOpen}
          onClose={() => setIsWorkspaceModalOpen(false)}
          onSelectWorkspace={(workspace) => {
            setIsWorkspaceModalOpen(false);
            navigateTo(workspace);
          }}
          onRolesUpdated={(updatedRoles) => {
            setCurrentUser((prev) => (prev ? { ...prev, roles: updatedRoles } : null));
          }}
        />
      )}

      {currentRoute === 'discovery' && (
        <>
          {/* 2. MODERN FINANCE HERO & PLATFORM TELEMETRY */}
          <section className="finance-hero" id="hero">
        <div className="finance-hero-inner">
          <div className="finance-hero-eyebrow">
            <span className="eyebrow-accent-rule" />
            <span>VENTURE CAPITAL INTELLIGENCE & DEAL REGISTRY</span>
          </div>

          <h1 className="finance-hero-headline">
            Institutional Discovery for India's Next Generation Ventures.
          </h1>

          <p className="finance-hero-subtext">
            Standardized academic intelligence on televised Shark Tank pitches and registered platform listings. Track ask valuations, equity dilution, founder business models, and verified corporate registry attributes.
          </p>

          <div className="finance-hero-actions">
            <a
              className="finance-primary-btn"
              href="#explorer"
              onClick={scrollToExplorer}
              aria-label="Scroll to Startup Explorer"
            >
              <span>Explore Venture Registry</span>
              <span className="finance-btn-arrow" aria-hidden="true">↓</span>
            </a>

            <div className="finance-compliance-badge">
              <span className="badge-shield" aria-hidden="true">✦</span>
              <span>MySQL 8.0 ACID REGISTRY · ACADEMIC PROTOCOL</span>
            </div>
          </div>
        </div>

        {/* Real Dynamic Telemetry Ribbon */}
        <div className="finance-metrics-ribbon" aria-label="Ecosystem telemetry summary">
          <div className="finance-metric-card">
            <span className="metric-label">PUBLISHED VENTURES</span>
            <strong className="metric-value">
              {loading ? '—' : String(metrics.totalCount).padStart(2, '0')}
            </strong>
            <span className="metric-subtext">Total active portfolio</span>
          </div>

          <div className="finance-metric-card">
            <span className="metric-label">SOURCE DISTRIBUTION</span>
            <div className="metric-source-split">
              <span className="source-pill show-pill">
                <strong>{loading ? '—' : metrics.showCount}</strong> Shark Tank
              </span>
              <span className="source-pill platform-pill">
                <strong>{loading ? '—' : metrics.platformCount}</strong> Platform
              </span>
            </div>
            <span className="metric-subtext">Strict dual-source separation</span>
          </div>

          <div className="finance-metric-card">
            <span className="metric-label">TOTAL CAPITAL ASKED</span>
            <strong className="metric-value tabular-nums">
              {loading ? '—' : formatCurrency(metrics.totalAsk)}
            </strong>
            <span className="metric-subtext">Aggregate investment ask</span>
          </div>

          <div className="finance-metric-card">
            <span className="metric-label">AVG. REQUESTED EQUITY</span>
            <strong className="metric-value tabular-nums">
              {loading ? '—' : formatEquity(metrics.avgEquity)}
            </strong>
            <span className="metric-subtext">Across evaluated pitches</span>
          </div>
        </div>
      </section>

      {/* 3. STARTUP EXPLORER SECTION */}
      <section className="explorer" id="explorer">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              VENTURE REGISTRY
            </div>
            <h2>
              Explore the Ecosystem<span>.</span>
            </h2>
            <p className="section-description">
              Browse published records from the database. Historical show
              pitches and platform listings are categorized distinctly.
            </p>
          </div>

          <div className="result-count-badge" aria-live="polite">
            <strong>
              {loading
                ? '—'
                : String(visibleStartups.length).padStart(2, '0')}
            </strong>
            <span>STARTUPS FOUND</span>
          </div>
        </div>

        {/* Clean Deal Desk Advisory Notice (Replaces Childish Cartoon) */}
        <div className="deal-desk-notice">
          <div className="notice-left">
            <div className="notice-icon-box" aria-hidden="true">
              <span>⚖</span>
            </div>
            <div className="notice-copy">
              <strong>Institutional Deal Intelligence</strong>
              <p>
                {filter === 'ALL'
                  ? `Showing all ${visibleStartups.length} published records across televised pitches and registered platform ventures.`
                  : filter === 'SHOW'
                    ? `Showing ${visibleStartups.length} televised Shark Tank India pitches archived with original valuation asks.`
                    : `Showing ${visibleStartups.length} registered independent platform listings awaiting investor syndicated discovery.`}
                {search.trim() ? ` Filtered by "${search}".` : ''}
              </p>
            </div>
          </div>
          {(search || filter !== 'ALL') && (
            <button
              type="button"
              className="notice-clear-btn"
              onClick={handleClearFilters}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Toolbar: Search & Pitch-type Filters */}
        <div className="toolbar">
          <label className="search-box">
            <span className="search-icon" aria-hidden="true">
              ⌕
            </span>
            <span className="sr-only">Search startups</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by brand, sector, city, stage..."
              aria-label="Search by brand, sector, city, or stage"
            />
            <kbd>SEARCH</kbd>
          </label>

          <div
            className="filter-group"
            role="group"
            aria-label="Filter pitches by source"
          >
            {(
              [
                ['ALL', 'All pitches'],
                ['PLATFORM', 'Platform listings'],
                ['SHOW', 'Shark Tank show'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`filter-button ${filter === val ? 'active' : ''}`}
                aria-pressed={filter === val}
                onClick={() => setFilter(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Comparison Alert Banner */}
        {compareWarning && (
          <div className="compare-warning-banner" role="alert">
            <span className="warning-icon" aria-hidden="true">⚠</span>
            <span>{compareWarning}</span>
            <button
              type="button"
              className="warning-dismiss-btn"
              onClick={() => setCompareWarning(null)}
              aria-label="Dismiss warning"
            >
              ×
            </button>
          </div>
        )}

        {/* Error Feedback Panel */}
        {error && (
          <div className="feedback-panel error-panel" role="alert">
            <div className="error-copy">
              <strong>Database Connection Interrupted</strong>
              <p>{error}</p>
            </div>
            <button
              type="button"
              className="panel-btn"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading ? (
          <div className="startup-grid" aria-label="Loading startups...">
            {[1, 2, 3, 4].map((id) => (
              <div className="startup-card skeleton-card" key={id}>
                <div className="skeleton skeleton-badge" />
                <div className="skeleton skeleton-circle" />
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-text" />
                <div className="skeleton skeleton-text short" />
              </div>
            ))}
          </div>
        ) : !error && visibleStartups.length > 0 ? (
          /* Real Startup Card Grid */
          <div className="startup-grid">
            {visibleStartups.map((startup) => {
              const location = [
                startup.headquartersCity,
                startup.headquartersState,
              ]
                .filter(Boolean)
                .join(', ');

              const isPlatform = startup.pitchType === 'PLATFORM';
              const isSelected = selectedForCompare.some((s) => s.pitchId === startup.pitchId);

              return (
                <article
                  className={`startup-card ${isSelected ? 'selected-for-compare' : ''}`}
                  key={startup.pitchId}
                >
                  <div className="card-topline">
                    <span
                      className={`pitch-badge ${
                        isPlatform ? 'platform' : 'show'
                      }`}
                    >
                      <span className="badge-dot" />
                      {isPlatform ? 'PLATFORM LISTING' : 'SHARK TANK SHOW'}
                    </span>
                    <span className="pitch-number">
                      {formatPitchNumber(startup.pitchId)}
                    </span>
                  </div>

                  <div className="company-monogram" aria-hidden="true">
                    {startup.brandName.trim().charAt(0).toUpperCase() || 'S'}
                  </div>

                  <h3>{startup.brandName}</h3>
                  {startup.legalBusinessName && (
                    <p className="legal-name">{startup.legalBusinessName}</p>
                  )}

                  <p className="pitch-hook">
                    {startup.pitchHook ||
                      'A venture navigating strategic growth and investor partnership.'}
                  </p>

                  <div className="tag-row">
                    {startup.industry && (
                      <span className="info-tag">{startup.industry}</span>
                    )}
                    {startup.startupStage && (
                      <span className="info-tag stage-tag">
                        {formatStageName(startup.startupStage)}
                      </span>
                    )}
                  </div>

                  <div className="card-facts">
                    <div>
                      <span className="fact-label">LOCATION</span>
                      <strong>{location || 'Location not listed'}</strong>
                    </div>
                    <div>
                      <span className="fact-label">BUSINESS MODEL</span>
                      <strong>
                        {startup.businessModel || 'Not specified'}
                      </strong>
                    </div>
                  </div>

                  <div className="card-footer">
                    <div>
                      <span className="fact-label">ORIGINAL ASK</span>
                      <strong className="ask-value tabular-nums">
                        {formatCurrency(startup.originalAskAmount)}
                      </strong>
                    </div>
                    <div>
                      <span className="fact-label">EQUITY</span>
                      <strong className="tabular-nums">
                        {formatEquity(startup.originalAskEquityPct)}
                      </strong>
                    </div>
                    {startup.foundedYear && (
                      <div>
                        <span className="fact-label">FOUNDED</span>
                        <strong className="tabular-nums">
                          {startup.foundedYear}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Card Actions: View Details and Compare */}
                  <div className="card-actions-row">
                    <button
                      type="button"
                      className="card-btn card-btn-details"
                      onClick={() => setSelectedDetailStartup(startup)}
                      aria-label={`View full details for ${startup.brandName}`}
                    >
                      <span>View Details</span>
                      <span aria-hidden="true">→</span>
                    </button>

                    <button
                      type="button"
                      className={`card-btn card-btn-compare ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggleCompare(startup)}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'Remove' : 'Add'} ${startup.brandName} to comparison`}
                    >
                      <span aria-hidden="true">{isSelected ? '✓' : '+'}</span>
                      <span>{isSelected ? 'Selected' : 'Compare'}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : !error ? (
          /* Empty Search Feedback */
          <div className="feedback-panel empty-panel">
            <div className="empty-symbol" aria-hidden="true">⚖</div>
            <h3>No ventures found matching search criteria</h3>
            <p>
              We couldn't find any startups matching "{search}". Try searching
              for another sector, city, or reset your filters.
            </p>
            <button
              type="button"
              className="panel-btn"
              onClick={handleClearFilters}
            >
              Reset search filters
            </button>
          </div>
        ) : null}

        {/* Academic Data Note */}
        <div className="data-note">
          <span className="data-note-mark" aria-hidden="true">
            i
          </span>
          <p>
            Displaying active records from the Sauda MySQL database. Televised
            pitches and registered platform ventures are maintained under
            strict source separation.
          </p>
          <span className="data-note-right">SAUDA · 2026 DBMS</span>
        </div>
      </section>

      {/* 4. FOOTER */}
      <footer className="footer">
        <div className="footer-left">
          <a className="footer-brand" href="/" aria-label="Sauda Home">
            sauda<span>.</span>
          </a>
          <p>Institutional Startup Intelligence & Venture Discovery Platform.</p>
        </div>
        <div className="footer-right">
          <span className="footer-meta">ACADEMIC DBMS PROTOTYPE · 2026 · MYSQL 8.0</span>
        </div>
      </footer>

      {/* 5. STARTUP DETAIL MODAL */}
      <StartupDetailModal
        startup={selectedDetailStartup}
        isOpen={Boolean(selectedDetailStartup)}
        onClose={() => setSelectedDetailStartup(null)}
      />

      {/* 6. COMPARISON TRAY & MATRIX */}
      <ComparisonTray
        selectedStartups={selectedForCompare}
        onRemove={handleRemoveCompare}
        onClear={handleClearCompare}
        onOpenMatrix={() => setIsMatrixOpen(true)}
      />

      <ComparisonMatrix
        startups={selectedForCompare}
        isOpen={isMatrixOpen}
        onClose={() => setIsMatrixOpen(false)}
        onRemoveStartup={handleRemoveCompare}
      />
        </>
      )}
    </main>
  );
};

export default App;
