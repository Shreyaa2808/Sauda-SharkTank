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
import { NavDrawer } from './components/navigation/NavDrawer.tsx';
import { WorkspaceGate } from './components/workspace/WorkspaceGate.tsx';
import { FounderWorkspace } from './components/founder/FounderWorkspace.tsx';
import { InvestorWorkspace } from './components/investor/InvestorWorkspace.tsx';
import { ConnectionsHub } from './components/connections/ConnectionsHub.tsx';
import { StartupDetailModal } from './components/startup/StartupDetailModal.tsx';
import { ComparisonTray } from './components/compare/ComparisonTray.tsx';
import { ComparisonMatrix } from './components/compare/ComparisonMatrix.tsx';
import { DiscoveryHero } from './components/home/DiscoveryHero.tsx';
import { ViewerDashboard } from './components/dashboard/ViewerDashboard.tsx';
import { AdminReviewPage } from './components/admin/AdminReviewPage.tsx';
import { AdminLayout, type AdminNavSection } from './components/admin/AdminLayout.tsx';
import { AdminOverview } from './components/admin/AdminOverview.tsx';
import { AdminHistoricalManager } from './components/admin/AdminHistoricalManager.tsx';
import { AdminCsvImports } from './components/admin/AdminCsvImports.tsx';
import { NotFoundPage } from './components/notfound/NotFoundPage.tsx';
import { computeRegistryMetrics } from './utils/registryMetrics.ts';
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
type KnownRoute =
  | 'discovery'
  | 'login'
  | 'dashboard'
  | 'profile'
  | 'settings'
  | 'founder'
  | 'investor'
  | 'connections'
  | 'admin'
  | 'admin-overview'
  | 'admin-reviews'
  | 'admin-historical'
  | 'admin-imports';

// 'notfound' is a real view for unrecognised URLs; it has no path of its own (the address bar keeps the requested URL).
type AppRoute = KnownRoute | 'notfound';

// The public API caps a page at 100 rows; hitting the cap means KPI totals are a lower bound.
const STARTUP_FETCH_LIMIT = 100;
const MIN_LOADER_MS = 1400;

// Single source of truth for the (History API based) route model.
const ROUTE_PATHS: Record<KnownRoute, string> = {
  discovery: '/',
  login: '/login',
  dashboard: '/dashboard',
  profile: '/profile',
  settings: '/settings',
  founder: '/founder',
  investor: '/investor',
  connections: '/connections',
  admin: '/admin',
  'admin-overview': '/admin/overview',
  'admin-reviews': '/admin/reviews',
  'admin-historical': '/admin/historical',
  'admin-imports': '/admin/imports',
};

// Routes that need a server-verified session. Role checks for workspaces are layered on top.
const AUTH_REQUIRED_ROUTES: AppRoute[] = [
  'dashboard',
  'profile',
  'settings',
  'founder',
  'investor',
  'connections',
  'admin',
  'admin-overview',
  'admin-reviews',
  'admin-historical',
  'admin-imports',
];

const ROUTE_LABELS: Record<AppRoute, string> = {
  notfound: 'Page Not Found',
  discovery: 'Startup Discovery',
  login: 'Sign In',
  dashboard: 'Dashboard',
  profile: 'Profile',
  settings: 'Account Settings',
  founder: 'Founder Workspace',
  investor: 'Investor Deal Room',
  connections: 'Connections',
  admin: 'Admin Console',
  'admin-overview': 'Admin Overview',
  'admin-reviews': 'Pitch Review Queue',
  'admin-historical': 'Historical Data Management',
  'admin-imports': 'CSV Imports & Reports',
};

const WORKSPACE_ROUTES: AppRoute[] = [
  'dashboard',
  'founder',
  'investor',
  'connections',
  'admin',
  'admin-overview',
  'admin-reviews',
  'admin-historical',
  'admin-imports',
];

const ADMIN_ROUTES: AppRoute[] = [
  'admin',
  'admin-overview',
  'admin-reviews',
  'admin-historical',
  'admin-imports',
];

const pathToRoute = (rawPath: string): AppRoute => {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
  const match = (Object.keys(ROUTE_PATHS) as KnownRoute[]).find((r) => ROUTE_PATHS[r] === path);
  // Unrecognised URLs are a genuine 404, never silently the homepage.
  return match ?? 'notfound';
};

// Depth of the current history entry within Sauda (0 = the page the tab first loaded).
// Stored in history.state so it survives refresh and tells us whether Back stays inside the app.
const getHistoryDepth = (): number => {
  const state = window.history.state as { saudaDepth?: unknown } | null;
  return typeof state?.saudaDepth === 'number' ? state.saudaDepth : 0;
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
  // Minimum on-screen time for the shark loader on page load, so fast (local) responses
  // don't make it vanish before it can be seen. Only applies to the initial load, never to in-app navigation.
  const [minLoaderElapsed, setMinLoaderElapsed] = useState<boolean>(false);
  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => setMinLoaderElapsed(true), reduced ? 600 : MIN_LOADER_MS);
    return () => clearTimeout(timer);
  }, []);
  const [isInitialDataDone, setIsInitialDataDone] = useState<boolean>(false);

  // Authentication & Access Routing State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [requestedRoute, setRequestedRoute] = useState<AppRoute>(getInitialRoute);
  // Workspace Chooser Modal State
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState<boolean>(false);
  // Left navigation drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const hamburgerRef = React.useRef<HTMLButtonElement>(null);

  // Detail Modal & Comparison Matrix States
  const [selectedDetailStartup, setSelectedDetailStartup] = useState<Startup | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<Startup[]>([]);
  const [isMatrixOpen, setIsMatrixOpen] = useState<boolean>(false);
  const [compareWarning, setCompareWarning] = useState<string | null>(null);

  // Navigation helper synchronized with browser History API.
  // `replace` is used for guard redirects so Back never lands on a page the guard just rejected.
  const navigateTo = useCallback((route: KnownRoute, replace = false) => {
    setRequestedRoute(route);
    const path = ROUTE_PATHS[route];
    if (window.location.pathname !== path) {
      const depth = getHistoryDepth();
      if (replace) window.history.replaceState({ saudaDepth: depth }, '', path);
      else window.history.pushState({ saudaDepth: depth + 1 }, '', path);
    }
    window.scrollTo?.({ top: 0 });
  }, []);

  // Route to resume after a guard-triggered sign-in (never trusted for authorization).
  const returnToRef = React.useRef<KnownRoute | null>(null);

  // Synchronize browser back/forward buttons with currentRoute
  useEffect(() => {
    const handlePopState = () => {
      setIsDrawerOpen(false);
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
  const guardRedirect: KnownRoute | null = !isInitialAuthDone
    ? null
    : !currentUser && AUTH_REQUIRED_ROUTES.includes(requestedRoute)
      ? 'login'
      : currentUser && requestedRoute === 'login'
        ? 'discovery'
        : requestedRoute === 'admin'
          ? 'admin-overview'
          : null;
  const currentRoute: AppRoute = guardRedirect ?? requestedRoute;

  // Keep the address bar in step with a guard redirect (history only; no state updates here).
  useEffect(() => {
    if (!guardRedirect) return;
    if (guardRedirect === 'login' && requestedRoute !== 'notfound') returnToRef.current = requestedRoute;
    const path = ROUTE_PATHS[guardRedirect];
    if (window.location.pathname !== path) window.history.replaceState({ saudaDepth: getHistoryDepth() }, '', path);
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
  const showBootstrapLoader = !introActive && (isBootstrapPending || !minLoaderElapsed);

  // Keep the tab title in step with the visible section
  useEffect(() => {
    document.title = `${ROUTE_LABELS[currentRoute]} · Sauda`;
  }, [currentRoute]);

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
    const requested = pathToRoute(window.location.pathname);
    if (requested === 'notfound') {
      // Keep the unknown URL visible as a 404 for everyone.
      setRequestedRoute('notfound');
    } else if (!currentUserRef.current) {
      navigateTo('login', true);
    } else {
      navigateTo(requested, true);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    await logout();
    returnToRef.current = null;
    setIsDrawerOpen(false);
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
        const response = await fetchStartups(STARTUP_FETCH_LIMIT, controller.signal);
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

  // KPI aggregates derived strictly from published records (invalid/missing values excluded, never zero-filled)
  const metrics = useMemo(() => computeRegistryMetrics(startups), [startups]);
  const isRegistryCapped = startups.length >= STARTUP_FETCH_LIMIT;

  const handleClearFilters = () => {
    setSearch('');
    setFilter('ALL');
  };

  const scrollToExplorer = () => {
    const el = document.getElementById('explorer');
    if (el) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
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
          <SaudaLoader message="Entering Sauda" />
        )}
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onBrowseAsGuest={() => navigateTo('discovery')}
        />
      </>
    );
  }

  // Dedicated Administrative Application Shell
  if (ADMIN_ROUTES.includes(currentRoute)) {
    const adminSection: AdminNavSection =
      currentRoute === 'admin-reviews'
        ? 'reviews'
        : currentRoute === 'admin-historical'
          ? 'historical'
          : currentRoute === 'admin-imports'
            ? 'imports'
            : 'overview';

    return (
      <>
        {introActive && (
          <CinematicIntro onComplete={handleIntroComplete} />
        )}
        {showBootstrapLoader && (
          <SaudaLoader message="Entering Sauda Admin" />
        )}
        <AdminLayout
          activeSection={adminSection}
          currentUser={currentUser}
          authorized={Boolean(currentUser && hasRole('ADMIN'))}
          onNavigate={(sec) => {
            const target: KnownRoute =
              sec === 'reviews'
                ? 'admin-reviews'
                : sec === 'historical'
                  ? 'admin-historical'
                  : sec === 'imports'
                    ? 'admin-imports'
                    : 'admin-overview';
            navigateTo(target);
          }}
          onExitToPublic={() => navigateTo('dashboard')}
          onLogout={handleLogout}
        >
          {adminSection === 'overview' && (
            <AdminOverview
              onNavigate={(sec) => {
                const target: KnownRoute =
                  sec === 'reviews'
                    ? 'admin-reviews'
                    : sec === 'historical'
                      ? 'admin-historical'
                      : 'admin-imports';
                navigateTo(target);
              }}
            />
          )}

          {adminSection === 'reviews' && (
            <AdminReviewPage
              authorized={Boolean(currentUser && hasRole('ADMIN'))}
              onReturnToDashboard={() => navigateTo('admin-overview')}
            />
          )}

          {adminSection === 'historical' && (
            <AdminHistoricalManager />
          )}

          {adminSection === 'imports' && (
            <AdminCsvImports />
          )}
        </AdminLayout>
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
        <SaudaLoader message="Loading venture registry" />
      )}

      {/* 1. DARK NAVY NAVIGATION HEADER */}
      <header className={`topbar ${currentRoute === 'discovery' ? 'topbar--home' : ''}`}>
        <div className="topbar-left">
          <button
            ref={hamburgerRef}
            type="button"
            className={`topbar-hamburger ${isDrawerOpen ? 'active' : ''}`}
            onClick={() => setIsDrawerOpen((open) => !open)}
            aria-label={isDrawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isDrawerOpen}
            aria-controls="app-nav-drawer"
            aria-haspopup="dialog"
          >
            <span className="hamburger-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>

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

          <span className="topbar-context" aria-label="Current section">
            <span className="topbar-context-divider" aria-hidden="true" />
            <span className="topbar-context-label">{ROUTE_LABELS[currentRoute]}</span>
          </span>
        </div>

        {currentRoute === 'discovery' && (
          <>
            <nav className="topbar-links" aria-label="Homepage sections">
              <button type="button" className="is-current" aria-current="page" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</button>
              <button type="button" onClick={() => { setFilter('ALL'); scrollToExplorer(); }}>Venture Registry</button>
              <button type="button" onClick={() => { setSearch(''); setFilter('SHOW'); scrollToExplorer(); }}>Shark Tank Archive</button>
              <button type="button" onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}>About</button>
              {currentUser && <button type="button" onClick={() => navigateTo('dashboard')}>Dashboard</button>}
            </nav>
            <form
              className="topbar-search"
              role="search"
              onSubmit={(e) => { e.preventDefault(); scrollToExplorer(); }}
            >
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search startups, sectors, cities…"
                aria-label="Search startups"
              />
              <button type="submit" aria-label="Search">⌕</button>
            </form>
          </>
        )}

        <div className="topbar-right">
          {/* Real Authentication State: Account Menu or Sign In CTA */}
          {currentUser ? (
            <AccountMenu
              user={currentUser}
              currentRoute={currentRoute}
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

      {isInitialAuthDone && currentRoute === 'dashboard' && currentUser && (
        <ViewerDashboard
          currentUser={currentUser}
          startups={startups}
          loading={loading}
          hasError={Boolean(error)}
          metrics={metrics}
          isCapped={isRegistryCapped}
          hasFounder={hasRole('FOUNDER')}
          hasInvestor={hasRole('INVESTOR')}
          onSelectStartup={(startup) => {
            setSelectedDetailStartup(startup);
            navigateTo('discovery');
          }}
          onNavigateToDiscovery={() => navigateTo('discovery')}
          onOpenWorkspaces={() => setIsWorkspaceModalOpen(true)}
          onNavigateToFounder={() => navigateTo('founder')}
          onNavigateToInvestor={() => navigateTo('investor')}
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

      {/* NOT FOUND: unrecognised URLs never fall through to discovery */}
      {currentRoute === 'notfound' && (
        <NotFoundPage
          requestedPath={typeof window !== 'undefined' ? window.location.pathname : ''}
          isSignedIn={Boolean(currentUser)}
          canGoBack={getHistoryDepth() > 0}
          onGoHome={() => navigateTo('discovery')}
          onGoBack={() => window.history.back()}
          onSignIn={() => navigateTo('login')}
        />
      )}

      {/* LEFT NAVIGATION DRAWER */}
      <NavDrawer
        isOpen={isDrawerOpen}
        currentRoute={currentRoute}
        currentUser={currentUser}
        onClose={() => setIsDrawerOpen(false)}
        onNavigate={(route) => navigateTo(route)}
        onOpenWorkspaces={() => setIsWorkspaceModalOpen(true)}
        onSignIn={() => navigateTo('login')}
        onLogout={handleLogout}
        returnFocusRef={hamburgerRef}
      />

      {isWorkspaceModalOpen && (
        <WorkspaceChooserModal
          currentUser={currentUser}
          currentRoute={currentRoute}
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
          <DiscoveryHero
            loading={loading}
            hasError={Boolean(error)}
            metrics={metrics}
            isCapped={isRegistryCapped}
            startups={startups}
            onSelectStartup={setSelectedDetailStartup}
            onExplore={scrollToExplorer}
            onBrowseShow={() => {
              setSearch('');
              setFilter('SHOW');
              scrollToExplorer();
            }}
          />

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
              Browse every published venture. Televised Shark Tank pitches
              and platform listings are always labelled distinctly.
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

        {/* Slim results bar: only shown while a search or source filter is narrowing the registry */}
        {(search.trim() || filter !== 'ALL') && (
          <div className="results-bar" role="status" aria-live="polite">
            <p>
              Showing <strong>{visibleStartups.length}</strong> of {startups.length}{' '}
              {startups.length === 1 ? 'venture' : 'ventures'}
              {filter !== 'ALL' && (
                <span className="results-chip">{filter === 'SHOW' ? 'Shark Tank' : 'Platform'}</span>
              )}
              {search.trim() && <span className="results-chip">&ldquo;{search.trim()}&rdquo;</span>}
            </p>
            <button type="button" className="results-reset" onClick={handleClearFilters}>
              Reset filters
            </button>
          </div>
        )}

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
          startups.length === 0 ? (
            /* The registry itself is empty: never imply a search problem */
            <div className="feedback-panel empty-panel">
              <div className="empty-symbol" aria-hidden="true">⚖</div>
              <h3>No ventures have been published yet</h3>
              <p>
                The registry has no published pitches at the moment. Published Shark Tank pitches and
                platform listings will appear here.
              </p>
              <button type="button" className="panel-btn" onClick={() => setReloadKey((k) => k + 1)}>
                Refresh registry
              </button>
            </div>
          ) : (
            /* Empty Search Feedback */
            <div className="feedback-panel empty-panel">
              <div className="empty-symbol" aria-hidden="true">⚖</div>
              <h3>No ventures match your search</h3>
              <p>
                {search.trim()
                  ? `We couldn't find any startups matching "${search.trim()}"${filter !== 'ALL' ? ' in this source' : ''}. `
                  : 'No startups are available for this source. '}
                Try another sector, city or stage, or reset your filters.
              </p>
              <button type="button" className="panel-btn" onClick={handleClearFilters}>
                Reset search filters
              </button>
            </div>
          )
        ) : null}

        {/* Registry note */}
        <div className="data-note">
          <span className="data-note-mark" aria-hidden="true">
            i
          </span>
          <p>
            Showing live records from the Sauda registry. Televised pitches and
            ventures listed on the platform are always kept clearly separate.
          </p>
          <span className="data-note-right">SAUDA · 2026</span>
        </div>
      </section>

      {/* 4. FOOTER */}
      <footer className="footer" id="about">
        <div className="footer-left">
          <a className="footer-brand" href="/" aria-label="Sauda Home">
            sauda<span>.</span>
          </a>
          <p>Startup discovery and founder–investor connections, in one place.</p>
        </div>
        <div className="footer-right">
          <span className="footer-meta">© 2026 SAUDA · THE STARTUP EXCHANGE</span>
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
