import React, { useEffect, useRef } from 'react';
import type { AuthUser } from '../../services/auth.ts';
import './NavDrawer.css';

export type DrawerRoute =
  | 'discovery'
  | 'archive'
  | 'dashboard'
  | 'founder'
  | 'investor'
  | 'connections'
  | 'profile'
  | 'settings'
  | 'admin';

interface NavDrawerProps {
  isOpen: boolean;
  /** Route currently displayed (after guards), used for active highlighting. */
  currentRoute: string;
  currentUser: AuthUser | null;
  onClose: () => void;
  onNavigate: (route: DrawerRoute) => void;
  onOpenWorkspaces: () => void;
  onSignIn: () => void;
  onLogout: () => void;
  /** Element that receives focus again when the drawer closes (the hamburger). */
  returnFocusRef: React.RefObject<HTMLElement | null>;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ROUTE_PATHS: Record<DrawerRoute, string> = {
  discovery: '/',
  archive: '/archive',
  dashboard: '/dashboard',
  founder: '/founder',
  investor: '/investor',
  connections: '/connections',
  profile: '/profile',
  settings: '/settings',
  admin: '/admin/overview',
};

/* Clean inline SVG icons (no icon dependency). */
const Icon: React.FC<{ name: 'discover' | 'archive' | 'dashboard' | 'founder' | 'investor' | 'connections' | 'profile' | 'settings' | 'admin' | 'workspaces' | 'signin' | 'signout' | 'close' }> = ({ name }) => {
  const common = { width: 18, height: 18, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'discover':
      return (<svg {...common}><circle cx="9" cy="9" r="5.5" /><path d="M13.2 13.2L17 17" /></svg>);
    case 'archive':
      return (<svg {...common}><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M2 8h16" /><path d="M9 12h2" /></svg>);
    case 'dashboard':
      return (<svg {...common}><rect x="3" y="3" width="5.5" height="5.5" rx="1" /><rect x="11.5" y="3" width="5.5" height="5.5" rx="1" /><rect x="3" y="11.5" width="5.5" height="5.5" rx="1" /><rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1" /></svg>);
    case 'founder':
      return (<svg {...common}><path d="M3 17h14" /><path d="M5 17V9l5-5 5 5v8" /><path d="M8.5 17v-4h3v4" /></svg>);
    case 'investor':
      return (<svg {...common}><path d="M3 16.5h14" /><path d="M4.5 13l3.5-4 3 2.5 4.5-6" /><path d="M12.5 5.5H16V9" /></svg>);
    case 'connections':
      return (<svg {...common}><path d="M3.5 5.5A1.5 1.5 0 015 4h10a1.5 1.5 0 011.5 1.5v6A1.5 1.5 0 0115 13H9.5L6 16v-3H5a1.5 1.5 0 01-1.5-1.5v-6z" /></svg>);
    case 'profile':
      return (<svg {...common}><circle cx="10" cy="7" r="3" /><path d="M4 16.5c0-3 2.7-4.5 6-4.5s6 1.5 6 4.5" /></svg>);
    case 'settings':
      return (<svg {...common}><path d="M4 6h8M15 6h1M4 14h1M8 14h8" /><circle cx="13.5" cy="6" r="1.6" /><circle cx="6.5" cy="14" r="1.6" /></svg>);
    case 'admin':
      return (<svg {...common}><path d="M10 2.5l6 2.2v4.9c0 3.3-2.2 6.1-6 7.9-3.8-1.8-6-4.6-6-7.9V4.7l6-2.2z" /><path d="M7 9.8l2 2 4-4" /></svg>);
    case 'workspaces':
      return (<svg {...common}><rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" /><rect x="11" y="3.5" width="5.5" height="5.5" rx="1" /><rect x="3.5" y="11" width="5.5" height="5.5" rx="1" /><rect x="11" y="11" width="5.5" height="5.5" rx="1" /></svg>);
    case 'signin':
      return (<svg {...common}><path d="M8 4H5a1.5 1.5 0 00-1.5 1.5v9A1.5 1.5 0 005 16h3" /><path d="M11.5 6.5L15 10l-3.5 3.5M15 10H7.5" /></svg>);
    case 'signout':
      return (<svg {...common}><path d="M8 4H5a1.5 1.5 0 00-1.5 1.5v9A1.5 1.5 0 005 16h3" /><path d="M12.5 6.5L16 10l-3.5 3.5M16 10H8.5" /></svg>);
    case 'close':
      return (<svg {...common}><path d="M5 5l10 10M15 5L5 15" /></svg>);
  }
};

/**
 * Left navigation drawer. Purely navigational: visibility of workspace items mirrors the
 * server-verified role list held by App, and every destination is still guarded by the route
 * guards and backend authorization. The drawer never grants or changes roles.
 */
export const NavDrawer: React.FC<NavDrawerProps> = ({
  isOpen,
  currentRoute,
  currentUser,
  onClose,
  onNavigate,
  onOpenWorkspaces,
  onSignIn,
  onLogout,
  returnFocusRef,
}) => {
  const panelRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus management, Escape, Tab trap and background scroll lock while open.
  useEffect(() => {
    if (!isOpen) return;
    const returnTarget = returnFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // The panel only becomes focusable once it is visible; retry on the next frame if the first
    // attempt ran before the visibility change was applied (also covers reduced-motion).
    closeBtnRef.current?.focus();
    const focusRaf = requestAnimationFrame(() => {
      if (!panelRef.current?.contains(document.activeElement)) closeBtnRef.current?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      const outside = !panelRef.current?.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(focusRaf);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnTarget?.focus?.();
    };
  }, [isOpen, returnFocusRef]);

  const roles = currentUser?.roles ?? [];
  const hasFounder = roles.includes('FOUNDER');
  const hasInvestor = roles.includes('INVESTOR');
  const hasAdmin = roles.includes('ADMIN');
  const initial = currentUser?.fullName?.trim().charAt(0).toUpperCase() || 'U';

  const go = (route: DrawerRoute) => {
    onClose();
    onNavigate(route);
  };

  const renderLink = (route: DrawerRoute, label: string, icon: Parameters<typeof Icon>[0]['name'], sub?: string) => {
    const active = currentRoute === route;
    return (
      <li key={route}>
        <a
          href={ROUTE_PATHS[route]}
          className={`nav-drawer-link ${active ? 'active' : ''}`}
          aria-current={active ? 'page' : undefined}
          onClick={(e) => {
            // Let the browser handle modified clicks (new tab etc.)
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            go(route);
          }}
        >
          <span className="nav-drawer-link-icon"><Icon name={icon} /></span>
          <span className="nav-drawer-link-text">
            <span className="nav-drawer-link-label">{label}</span>
            {sub && <span className="nav-drawer-link-sub">{sub}</span>}
          </span>
        </a>
      </li>
    );
  };

  return (
    <div
      className={`nav-drawer-root ${isOpen ? 'is-open' : ''}`}
      // Closed drawer stays mounted for the slide-out but is inert and hidden from assistive tech.
      inert={!isOpen}
      aria-hidden={!isOpen}
    >
      <div className="nav-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        id="app-nav-drawer"
        className="nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
      >
        <div className="nav-drawer-header">
          <div className="nav-drawer-brand">
            <span className="nav-drawer-wordmark">
              sauda<span>.</span>
            </span>
            <span className="nav-drawer-descriptor">The Startup Exchange</span>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="nav-drawer-close"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="nav-drawer-scroll">
          <nav aria-label="Primary">
            <p className="nav-drawer-section-label">Navigate</p>
            <ul className="nav-drawer-list">
              {renderLink('discovery', 'Startup Discovery', 'discover')}
              {renderLink('archive', 'Shark Tank Archive', 'archive', 'Broadcast seasons, episodes & deals')}
              {currentUser && renderLink('dashboard', 'Dashboard', 'dashboard', 'Your workspace overview')}
              {currentUser && (
                <li>
                  <button
                    type="button"
                    className="nav-drawer-link"
                    onClick={() => {
                      onClose();
                      onOpenWorkspaces();
                    }}
                  >
                    <span className="nav-drawer-link-icon"><Icon name="workspaces" /></span>
                    <span className="nav-drawer-link-text">
                      <span className="nav-drawer-link-label">Workspaces</span>
                      <span className="nav-drawer-link-sub">Switch or activate a workspace</span>
                    </span>
                  </button>
                </li>
              )}
              {currentUser && hasFounder && renderLink('founder', 'Founder Workspace', 'founder')}
              {currentUser && hasInvestor && renderLink('investor', 'Investor Deal Room', 'investor')}
              {currentUser && (hasFounder || hasInvestor) && renderLink('connections', 'Connections', 'connections')}
              {currentUser && hasAdmin && renderLink('admin', 'Admin Console', 'admin', 'Moderation, historical registry & imports')}
            </ul>
          </nav>

          <section className="nav-drawer-account" aria-label="Account">
            <p className="nav-drawer-section-label">Account</p>
            {currentUser ? (
              <>
                <div className="nav-drawer-identity">
                  <span className="nav-drawer-avatar" aria-hidden="true">{initial}</span>
                  <div className="nav-drawer-identity-text">
                    <span className="nav-drawer-name">{currentUser.fullName}</span>
                    <span className="nav-drawer-email">{currentUser.email}</span>
                    <ul className="nav-drawer-roles" aria-label="Assigned roles">
                      {(roles.length > 0 ? roles : ['VIEWER']).map((r) => (
                        <li key={r} className="nav-drawer-role">{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <ul className="nav-drawer-list">
                  {renderLink('profile', 'Profile', 'profile')}
                  {renderLink('settings', 'Account Settings', 'settings')}
                </ul>
              </>
            ) : (
              <div className="nav-drawer-guest">
                <p>Browsing as guest. Sign in to activate a Founder or Investor workspace.</p>
                <button
                  type="button"
                  className="nav-drawer-primary"
                  onClick={() => {
                    onClose();
                    onSignIn();
                  }}
                >
                  <Icon name="signin" />
                  <span>Sign In</span>
                </button>
              </div>
            )}
          </section>
        </div>

        {currentUser && (
          <div className="nav-drawer-footer">
            <button
              type="button"
              className="nav-drawer-link signout"
              onClick={() => {
                onClose();
                onLogout();
              }}
            >
              <span className="nav-drawer-link-icon"><Icon name="signout" /></span>
              <span className="nav-drawer-link-text">
                <span className="nav-drawer-link-label">Sign Out</span>
              </span>
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};

export default NavDrawer;
