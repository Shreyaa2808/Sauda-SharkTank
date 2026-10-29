import React, { useEffect, useRef, useState } from 'react';
import type { AuthUser } from '../../services/auth.ts';
import './AdminLayout.css';

export type AdminNavSection = 'overview' | 'reviews' | 'historical' | 'imports';

interface AdminLayoutProps {
  activeSection: AdminNavSection;
  currentUser: AuthUser | null;
  authorized: boolean;
  onNavigate: (section: AdminNavSection) => void;
  onExitToPublic: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const SECTION_TITLES: Record<AdminNavSection, { title: string; subtitle: string }> = {
  overview: {
    title: 'Operational Overview',
    subtitle: 'System telemetry, backlog metrics, and administrative shortcuts',
  },
  reviews: {
    title: 'Pitch Moderation Queue',
    subtitle: 'Review founder venture submissions before public registry release',
  },
  historical: {
    title: 'Historical Shark Tank Data',
    subtitle: 'Manage televised seasons, episodes, and the institutional Sharks roster',
  },
  imports: {
    title: 'CSV Imports & Reports',
    subtitle: 'Batch upload historical pitch data and inspect past import audits',
  },
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  activeSection,
  currentUser,
  authorized,
  onNavigate,
  onExitToPublic,
  onLogout,
  children,
}) => {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close mobile drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileDrawerOpen]);

  const handleNavClick = (section: AdminNavSection) => {
    setIsMobileDrawerOpen(false);
    onNavigate(section);
  };

  // If user does not hold verified ADMIN role
  if (!authorized) {
    return (
      <div className="admin-shell admin-access-denied-stage">
        <div className="admin-access-denied-card" role="alert">
          <div className="denied-crest">
            <span className="denied-icon">🛡</span>
          </div>
          <span className="denied-badge">AUTHORIZATION REQUIRED</span>
          <h1>Administrator Access Restricted</h1>
          <p>
            The Sauda Admin Console requires verified server credentials with the <strong>ADMIN</strong> role.
            Your current account session does not hold administrative permissions.
          </p>
          <div className="denied-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={onExitToPublic}
            >
              Return to Public Exchange
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={onLogout}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentInfo = SECTION_TITLES[activeSection] || SECTION_TITLES.overview;
  const initial = currentUser?.fullName?.trim().charAt(0).toUpperCase() || 'A';

  return (
    <div className="admin-shell">
      {/* Mobile Drawer Backdrop */}
      {isMobileDrawerOpen && (
        <div
          className="admin-drawer-backdrop"
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Admin Sidebar (Desktop Sticky + Mobile Drawer) */}
      <aside
        ref={drawerRef}
        className={`admin-sidebar ${isMobileDrawerOpen ? 'drawer-open' : ''}`}
        aria-label="Admin Navigation"
      >
        {/* Brand Lockup */}
        <div className="admin-brand-header">
          <div className="admin-logo-mark" aria-hidden="true">
            <svg viewBox="0 0 36 36" fill="none" width="22" height="22">
              <path
                d="M18 2 L32 7 V18 C32 26 26 32 18 35 C10 32 4 26 4 18 V7 L18 2 Z"
                fill="#0B1120"
                stroke="#C3A064"
                strokeWidth="1.6"
              />
              <path
                d="M12 24 C14 24 16 22 17 19 C18 15 19 10 24 9 C22 13 22 18 25 21 C22 22 18 24 12 24 Z"
                fill="#C3A064"
              />
            </svg>
          </div>
          <div className="admin-brand-titles">
            <span className="admin-brand-title">
              SAUDA<span className="brand-dot">.</span>
            </span>
            <span className="admin-console-tag">ADMIN CONSOLE</span>
          </div>
          <button
            type="button"
            className="admin-drawer-close-btn"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="admin-nav-menu">
          <div className="admin-nav-group-label">OPERATIONS</div>

          <button
            type="button"
            className={`admin-nav-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => handleNavClick('overview')}
            aria-current={activeSection === 'overview' ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </span>
            <span className="nav-label">Overview</span>
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeSection === 'reviews' ? 'active' : ''}`}
            onClick={() => handleNavClick('reviews')}
            aria-current={activeSection === 'reviews' ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                <path d="M8 1.5l5 1.8v4.1c0 2.8-1.8 5.1-5 6.8-3.2-1.7-5-4-5-6.8V3.3L8 1.5z" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.5 7.8l1.6 1.6 3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="nav-label">Pitch Reviews</span>
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeSection === 'historical' ? 'active' : ''}`}
            onClick={() => handleNavClick('historical')}
            aria-current={activeSection === 'historical' ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                <ellipse cx="8" cy="4" rx="6" ry="2.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M2 4v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V4" stroke="currentColor" strokeWidth="1.4" />
                <path d="M2 8v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V8" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </span>
            <span className="nav-label">Historical Data</span>
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeSection === 'imports' ? 'active' : ''}`}
            onClick={() => handleNavClick('imports')}
            aria-current={activeSection === 'imports' ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                <path d="M2 11v3h12v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M8 2v9M4.5 5.5L8 2l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="nav-label">CSV Imports</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="admin-sidebar-footer">
          <button
            type="button"
            className="admin-exit-btn"
            onClick={onExitToPublic}
            title="Return to the public Sauda exchange"
          >
            <span className="exit-arrow" aria-hidden="true">←</span>
            <span>Back to Sauda</span>
          </button>

          <div className="admin-user-card">
            <div className="admin-avatar" aria-hidden="true">
              {initial}
            </div>
            <div className="admin-user-info">
              <span className="admin-user-name">{currentUser?.fullName || 'Administrator'}</span>
              <span className="admin-user-email">{currentUser?.email || ''}</span>
            </div>
            <button
              type="button"
              className="admin-logout-icon-btn"
              onClick={onLogout}
              title="Sign out of administrative session"
              aria-label="Sign out"
            >
              ⎋
            </button>
          </div>
        </div>
      </aside>

      {/* Main Admin Workspace Container */}
      <div className="admin-workspace-pane">
        {/* Top Operational Utility Bar */}
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="admin-hamburger-btn"
              onClick={() => setIsMobileDrawerOpen(true)}
              aria-label="Open administrative navigation"
            >
              <span />
              <span />
              <span />
            </button>

            <div className="admin-breadcrumbs">
              <span className="crumb-root">SAUDA // ADMIN</span>
              <span className="crumb-sep" aria-hidden="true">/</span>
              <span className="crumb-active">{currentInfo.title}</span>
            </div>
          </div>

          <div className="topbar-right">
            <div className="admin-env-pill">
              <span className="env-dot" />
              <span className="env-text">ACTIVE CONSOLE</span>
            </div>

            <button
              type="button"
              className="admin-exit-ghost-btn"
              onClick={onExitToPublic}
            >
              <span>Exit Console →</span>
            </button>
          </div>
        </header>

        {/* Section Heading Banner */}
        <div className="admin-section-header">
          <div>
            <h1>{currentInfo.title}</h1>
            <p className="admin-section-subtitle">{currentInfo.subtitle}</p>
          </div>
        </div>

        {/* Dynamic Section Content */}
        <main className="admin-main-stage">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
