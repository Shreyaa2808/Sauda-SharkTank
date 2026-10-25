import React, { useState } from 'react';
import type { AuthUser } from '../../services/auth.ts';
import { activateWorkspaceRole } from '../../services/workspace.ts';
import './WorkspaceChooserModal.css';

export interface WorkspaceChooserModalProps {
  currentUser: AuthUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkspace: (workspace: 'discovery' | 'founder' | 'investor' | 'connections') => void;
  onRolesUpdated: (updatedRoles: string[]) => void;
}

export const WorkspaceChooserModal: React.FC<WorkspaceChooserModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSelectWorkspace,
  onRolesUpdated,
}) => {
  const [activatingRole, setActivatingRole] = useState<'FOUNDER' | 'INVESTOR' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const roles = currentUser?.roles || ['VIEWER'];
  const hasFounder = roles.includes('FOUNDER');
  const hasInvestor = roles.includes('INVESTOR');

  const handleActivate = async (role: 'FOUNDER' | 'INVESTOR') => {
    setErrorMessage(null);
    setActivatingRole(role);

    const res = await activateWorkspaceRole(role);
    setActivatingRole(null);

    if (res.ok) {
      onRolesUpdated(res.roles);
      onSelectWorkspace(role === 'FOUNDER' ? 'founder' : 'investor');
      onClose();
    } else {
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="workspace-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title">
      <div className="workspace-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="workspace-modal-header">
          <div className="workspace-brand-pill">
            <span className="gold-dot" /> SAUDA WORKSPACE REGISTRY
          </div>
          <button className="workspace-close-btn" onClick={onClose} aria-label="Close workspace chooser">
            ✕
          </button>
        </div>

        <h2 id="workspace-modal-title" className="workspace-modal-heading">
          Choose your workspace.
        </h2>
        <p className="workspace-modal-sub">
          Select an authorized environment or activate specialized founder and investor tools for your account.
        </p>

        {errorMessage && (
          <div className="workspace-error-banner" role="alert">
            <span className="error-icon">⚠️</span> {errorMessage}
          </div>
        )}

        <div className="workspace-cards-grid">
          {/* 1. VIEWER WORKSPACE */}
          <div className="workspace-card active-card">
            <div className="workspace-card-badge authorized">ACTIVE FOR ALL</div>
            <div className="workspace-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="28" height="28">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3v18M3 12h18" strokeDasharray="2 2" />
                <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2" />
              </svg>
            </div>
            <h3 className="workspace-card-title">Viewer Workspace</h3>
            <p className="workspace-card-desc">
              Explore published venture listings, evaluate deal telemetry, and analyze historical show pitches.
            </p>
            <div className="workspace-card-footer">
              <button
                type="button"
                className="workspace-action-btn primary"
                onClick={() => {
                  onSelectWorkspace('discovery');
                  onClose();
                }}
              >
                Enter Discovery →
              </button>
            </div>
          </div>

          {/* 2. FOUNDER WORKSPACE */}
          <div className={`workspace-card ${hasFounder ? 'active-card' : ''}`}>
            <div className={`workspace-card-badge ${hasFounder ? 'authorized' : 'available'}`}>
              {hasFounder ? 'AUTHORIZED' : 'SELF-SERVICE ACTIVATION'}
            </div>
            <div className="workspace-card-icon gold-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="28" height="28">
                <path d="M4 20h16M12 4l7 8H5l7-8z" />
                <circle cx="12" cy="15" r="2" />
              </svg>
            </div>
            <h3 className="workspace-card-title">Founder Workspace</h3>
            <p className="workspace-card-desc">
              Create and manage your own startup pitches, draft funding asks, and respond to investor inquiries.
            </p>
            <div className="workspace-card-footer">
              {hasFounder ? (
                <button
                  type="button"
                  className="workspace-action-btn primary"
                  onClick={() => {
                    onSelectWorkspace('founder');
                    onClose();
                  }}
                >
                  Enter Founder Suite →
                </button>
              ) : (
                <button
                  type="button"
                  className="workspace-action-btn secondary"
                  disabled={activatingRole === 'FOUNDER'}
                  onClick={() => handleActivate('FOUNDER')}
                >
                  {activatingRole === 'FOUNDER' ? 'Activating...' : 'Activate Founder Workspace'}
                </button>
              )}
            </div>
          </div>

          {/* 3. INVESTOR WORKSPACE */}
          <div className={`workspace-card ${hasInvestor ? 'active-card' : ''}`}>
            <div className={`workspace-card-badge ${hasInvestor ? 'authorized' : 'available'}`}>
              {hasInvestor ? 'AUTHORIZED' : 'SELF-SERVICE ACTIVATION'}
            </div>
            <div className="workspace-card-icon blue-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="28" height="28">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M7 15l4-4 3 3 4-5" />
                <circle cx="18" cy="9" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <h3 className="workspace-card-title">Investor Workspace</h3>
            <p className="workspace-card-desc">
              Discover vetted investment opportunities, evaluate founder proposals, and initiate deal connections.
            </p>
            <div className="workspace-card-footer">
              {hasInvestor ? (
                <button
                  type="button"
                  className="workspace-action-btn primary"
                  onClick={() => {
                    onSelectWorkspace('investor');
                    onClose();
                  }}
                >
                  Enter Deal Room →
                </button>
              ) : (
                <button
                  type="button"
                  className="workspace-action-btn secondary"
                  disabled={activatingRole === 'INVESTOR'}
                  onClick={() => handleActivate('INVESTOR')}
                >
                  {activatingRole === 'INVESTOR' ? 'Activating...' : 'Activate Investor Workspace'}
                </button>
              )}
            </div>
          </div>
        </div>

        {(hasFounder || hasInvestor) && (
          <div className="workspace-connections-shortcut">
            <div className="shortcut-info">
              <span className="shortcut-title">Connections & Direct Inquiries</span>
              <span className="shortcut-desc">Manage inbound investor requests and accepted founder conversations.</span>
            </div>
            <button
              type="button"
              className="workspace-shortcut-btn"
              onClick={() => {
                onSelectWorkspace('connections');
                onClose();
              }}
            >
              Open Connections Hub →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
