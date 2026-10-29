import React, { useEffect, useRef, useState } from 'react';
import type { AuthUser } from '../../services/auth.ts';
import { checkSession } from '../../services/auth.ts';
import { activateWorkspaceRole } from '../../services/workspace.ts';
import './WorkspaceChooserModal.css';

export interface WorkspaceChooserModalProps {
  currentUser: AuthUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkspace: (workspace: 'discovery' | 'dashboard' | 'founder' | 'investor' | 'connections' | 'admin') => void;
  onRolesUpdated: (updatedRoles: string[]) => void;
  /** Current app route lets the chooser clearly identify the open workspace. */
  currentRoute: string;
}

export const WorkspaceChooserModal: React.FC<WorkspaceChooserModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSelectWorkspace,
  onRolesUpdated,
  currentRoute,
}) => {
  const [activatingRole, setActivatingRole] = useState<'FOUNDER' | 'INVESTOR' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes; Tab is trapped inside the dialog; focus moves in on open and returns to the opener on close.
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panelRef.current?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      opener?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const roles = currentUser?.roles || ['VIEWER'];
  const hasFounder = roles.includes('FOUNDER');
  const hasInvestor = roles.includes('INVESTOR');
  const hasAdmin = roles.includes('ADMIN');

  const isCurrentViewer = currentRoute === 'dashboard' || currentRoute === 'discovery' || currentRoute === 'archive';
  const isCurrentFounder = currentRoute === 'founder' && hasFounder;
  const isCurrentInvestor = currentRoute === 'investor' && hasInvestor;
  const isCurrentAdmin = (currentRoute === 'admin' || currentRoute.startsWith('admin-')) && hasAdmin;
  const isCurrentConnections = currentRoute === 'connections' && (hasFounder || hasInvestor);

  const handleActivate = async (role: 'FOUNDER' | 'INVESTOR') => {
    setErrorMessage(null);
    setActivatingRole(role);

    const res = await activateWorkspaceRole(role);

    if (res.ok) {
      // Verify refreshed session directly with the backend to ensure authoritative state
      try {
        const freshSession = await checkSession();
        if (freshSession.authenticated && freshSession.user) {
          onRolesUpdated(freshSession.user.roles);
        } else {
          onRolesUpdated(res.roles);
        }
      } catch {
        onRolesUpdated(res.roles);
      }
      setActivatingRole(null);
      onSelectWorkspace(role === 'FOUNDER' ? 'founder' : 'investor');
      onClose();
    } else {
      setActivatingRole(null);
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="workspace-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title">
      <div ref={panelRef} className="workspace-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="workspace-modal-header">
          <div className="workspace-brand-pill">
            <span className="gold-dot" /> SAUDA WORKSPACE REGISTRY
          </div>
          <button ref={closeBtnRef} type="button" className="workspace-close-btn" onClick={onClose} aria-label="Close workspace chooser">
            ✕
          </button>
        </div>

        <h2 id="workspace-modal-title" className="workspace-modal-heading">
          Choose your destination.
        </h2>
        <p className="workspace-modal-sub">
          Switch between your authorized workspaces, or activate Founder or Investor capabilities for your account.
        </p>

        {errorMessage && (
          <div className="workspace-error-banner" role="alert">
            <span className="error-icon">⚠️</span> {errorMessage}
          </div>
        )}

        <div className="workspace-cards-grid">
          {/* 1. VIEWER WORKSPACE */}
          <div className={`workspace-card ${isCurrentViewer ? 'current-card' : 'available-card'}`}>
            <div className={`workspace-card-badge ${isCurrentViewer ? 'current' : 'available'}`}>
              {isCurrentViewer ? 'CURRENT WORKSPACE' : 'AVAILABLE'}
            </div>
            <div className="workspace-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="28" height="28" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3v18M3 12h18" strokeDasharray="2 2" />
                <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2" />
              </svg>
            </div>
            <h3 className="workspace-card-title">Viewer Workspace</h3>
            <p className="workspace-card-desc">
              Explore live venture registry listings, inspect the broadcast archive, and evaluate startup metrics.
            </p>
            <div className="workspace-card-footer">
              <button
                type="button"
                className={`workspace-action-btn primary ${isCurrentViewer ? 'current-workspace-action' : ''}`}
                disabled={isCurrentViewer}
                onClick={() => {
                  onSelectWorkspace('dashboard');
                  onClose();
                }}
              >
                {isCurrentViewer ? 'Current Workspace ✓' : 'Switch to Viewer Dashboard →'}
              </button>
            </div>
          </div>

          {/* 2. FOUNDER WORKSPACE */}
          <div className={`workspace-card ${hasFounder ? 'active-card' : ''} ${isCurrentFounder ? 'current-card' : ''}`}>
            <div className={`workspace-card-badge ${isCurrentFounder ? 'current' : hasFounder ? 'authorized' : 'available'}`}>
              {isCurrentFounder ? 'CURRENT WORKSPACE' : hasFounder ? 'AVAILABLE TO YOU' : 'ACTIVATE ACCESS'}
            </div>
            <div className="workspace-card-icon gold-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="28" height="28" aria-hidden="true">
                <path d="M4 20h16M12 4l7 8H5l7-8z" />
                <circle cx="12" cy="15" r="2" />
              </svg>
            </div>
            <h3 className="workspace-card-title">Founder Studio</h3>
            <p className="workspace-card-desc">
              Draft and submit ventures for moderation review, monitor pitch lifecycles, and handle investor inquiries.
            </p>
            <div className="workspace-card-footer">
              {hasFounder ? (
                <button
                  type="button"
                  className={`workspace-action-btn primary ${isCurrentFounder ? 'current-workspace-action' : ''}`}
                  disabled={isCurrentFounder}
                  onClick={() => {
                    onSelectWorkspace('founder');
                    onClose();
                  }}
                >
                  {isCurrentFounder ? 'Current Workspace ✓' : 'Switch to Founder Studio →'}
                </button>
              ) : (
                <button
                  type="button"
                  className="workspace-action-btn secondary"
                  disabled={activatingRole === 'FOUNDER'}
                  onClick={() => handleActivate('FOUNDER')}
                >
                  {activatingRole === 'FOUNDER' ? 'Activating...' : 'Activate Founder Studio'}
                </button>
              )}
            </div>
          </div>

          {/* 3. INVESTOR WORKSPACE */}
          <div className={`workspace-card ${hasInvestor ? 'active-card' : ''} ${isCurrentInvestor ? 'current-card' : ''}`}>
            <div className={`workspace-card-badge ${isCurrentInvestor ? 'current' : hasInvestor ? 'authorized' : 'available'}`}>
              {isCurrentInvestor ? 'CURRENT WORKSPACE' : hasInvestor ? 'AVAILABLE TO YOU' : 'ACTIVATE ACCESS'}
            </div>
            <div className="workspace-card-icon blue-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="28" height="28" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M7 15l4-4 3 3 4-5" />
                <circle cx="18" cy="9" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <h3 className="workspace-card-title">Investor Deal Room</h3>
            <p className="workspace-card-desc">
              Discover vetted deals across sectors, maintain a private watchlist, and dispatch direct introduction requests.
            </p>
            <div className="workspace-card-footer">
              {hasInvestor ? (
                <button
                  type="button"
                  className={`workspace-action-btn primary ${isCurrentInvestor ? 'current-workspace-action' : ''}`}
                  disabled={isCurrentInvestor}
                  onClick={() => {
                    onSelectWorkspace('investor');
                    onClose();
                  }}
                >
                  {isCurrentInvestor ? 'Current Workspace ✓' : 'Switch to Deal Room →'}
                </button>
              ) : (
                <button
                  type="button"
                  className="workspace-action-btn secondary"
                  disabled={activatingRole === 'INVESTOR'}
                  onClick={() => handleActivate('INVESTOR')}
                >
                  {activatingRole === 'INVESTOR' ? 'Activating...' : 'Activate Deal Room'}
                </button>
              )}
            </div>
          </div>

          {/* 4. ADMIN CONSOLE (Rendered ONLY when confirmed by server session) */}
          {hasAdmin && (
            <div className={`workspace-card admin-card ${isCurrentAdmin ? 'current-card' : 'active-card'}`}>
              <div className={`workspace-card-badge ${isCurrentAdmin ? 'current' : 'authorized'}`}>
                {isCurrentAdmin ? 'CURRENT WORKSPACE' : 'AUTHORIZED · ADMIN ACCESS'}
              </div>
              <div className="workspace-card-icon slate-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="28" height="28" aria-hidden="true">
                  <path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <h3 className="workspace-card-title">Admin Console</h3>
              <p className="workspace-card-desc">
                Review submitted venture listings, maintain broadcast historical registries, and audit batch CSV imports.
              </p>
              <div className="workspace-card-footer">
                <button
                  type="button"
                  className={`workspace-action-btn primary admin-btn ${isCurrentAdmin ? 'current-workspace-action' : ''}`}
                  disabled={isCurrentAdmin}
                  onClick={() => {
                    onSelectWorkspace('admin');
                    onClose();
                  }}
                >
                  {isCurrentAdmin ? 'Current: Admin Console ✓' : 'Switch to Admin Console →'}
                </button>
              </div>
            </div>
          )}
        </div>

        {(hasFounder || hasInvestor) && (
          <div className={`workspace-connections-shortcut ${isCurrentConnections ? 'is-current' : ''}`}>
            <div className="shortcut-info">
              <span className="shortcut-title">Connections & Inquiries Hub</span>
              <span className="shortcut-desc">Manage inbound investor requests, active founder conversations, and chat logs.</span>
            </div>
            <button
              type="button"
              className="workspace-shortcut-btn"
              disabled={isCurrentConnections}
              onClick={() => {
                onSelectWorkspace('connections');
                onClose();
              }}
            >
              {isCurrentConnections ? 'Current: Connections Hub ✓' : 'Open Connections Hub →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
