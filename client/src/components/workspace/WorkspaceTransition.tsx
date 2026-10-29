import React, { useEffect, useRef } from 'react';
import './WorkspaceTransition.css';

export type WorkspaceType = 'viewer' | 'founder' | 'investor' | 'admin';

interface WorkspaceTransitionProps {
  workspace: WorkspaceType;
  onComplete: () => void;
  durationMs?: number;
}

const DEFAULT_DURATION_MS = 1400;

export const WorkspaceTransition: React.FC<WorkspaceTransitionProps> = ({
  workspace,
  onComplete,
  durationMs = DEFAULT_DURATION_MS,
}) => {
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const actualDuration = reduced ? 200 : durationMs;
    const timer = setTimeout(() => {
      onCompleteRef.current();
    }, actualDuration);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCompleteRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [durationMs]);

  const handleSkip = () => {
    onCompleteRef.current();
  };

  return (
    <div
      className={`workspace-transition-overlay workspace-transition--${workspace}`}
      role="status"
      aria-live="polite"
      aria-label={`Transitioning to ${workspace} workspace`}
    >
      <div className="transition-topbar">
        <span className="transition-sauda-mark">sauda<span>.</span></span>
        <button
          type="button"
          className="transition-skip-btn"
          onClick={handleSkip}
          aria-label="Skip workspace transition"
          title="Skip (Esc)"
        >
          <span>Skip</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="transition-content-container">
        {/* 1. VIEWER TRANSITION: TIMELINE DRAWING ACROSS SCREEN */}
        {workspace === 'viewer' && (
          <div className="transition-anim-wrapper anim-viewer">
            <div className="timeline-graphic" aria-hidden="true">
              <svg viewBox="0 0 400 60" className="timeline-svg" fill="none">
                <line x1="10" y1="30" x2="390" y2="30" className="timeline-track" />
                <line x1="10" y1="30" x2="390" y2="30" className="timeline-fill" />
                <circle cx="50" cy="30" r="7" className="timeline-node node-1" />
                <circle cx="150" cy="30" r="7" className="timeline-node node-2" />
                <circle cx="250" cy="30" r="7" className="timeline-node node-3" />
                <circle cx="350" cy="30" r="9" className="timeline-node node-4" />
              </svg>
              <div className="timeline-labels">
                <span>SEASON 01</span>
                <span>SEASON 02</span>
                <span>SEASON 03</span>
                <span>VAULT</span>
              </div>
            </div>
            <div className="transition-copy">
              <span className="transition-kicker">DESTINATION: PUBLIC REGISTRY</span>
              <h2>Entering Broadcast Archive & Discovery.</h2>
              <p>Synchronizing televised broadcast logs and platform listings…</p>
            </div>
          </div>
        )}

        {/* 2. FOUNDER TRANSITION: PITCH DOCUMENT ASSEMBLING GEOMETRICALLY */}
        {workspace === 'founder' && (
          <div className="transition-anim-wrapper anim-founder">
            <div className="pitch-blueprint-graphic" aria-hidden="true">
              <svg viewBox="0 0 160 200" className="blueprint-svg" fill="none">
                <rect x="10" y="10" width="140" height="180" rx="8" className="blueprint-card-frame" />
                <line x1="30" y1="35" x2="70" y2="35" className="blueprint-line line-header" />
                <rect x="30" y="55" width="34" height="34" rx="6" className="blueprint-monogram" />
                <line x1="72" y1="65" x2="130" y2="65" className="blueprint-line" />
                <line x1="72" y1="80" x2="115" y2="80" className="blueprint-line" />
                <line x1="30" y1="110" x2="130" y2="110" className="blueprint-line line-wide" />
                <line x1="30" y1="125" x2="120" y2="125" className="blueprint-line line-wide" />
                <rect x="30" y="150" width="45" height="18" rx="4" className="blueprint-pill" />
                <rect x="85" y="150" width="45" height="18" rx="4" className="blueprint-pill" />
              </svg>
            </div>
            <div className="transition-copy">
              <span className="transition-kicker founder-kicker">DESTINATION: FOUNDER SUITE</span>
              <h2>Entering Pitch Studio.</h2>
              <p>Assembling venture blueprint, ask structures, and inquiry desk…</p>
            </div>
          </div>
        )}

        {/* 3. INVESTOR TRANSITION: DEAL CARDS ARRANGING INTO SYNDICATE GRID */}
        {workspace === 'investor' && (
          <div className="transition-anim-wrapper anim-investor">
            <div className="deal-grid-graphic" aria-hidden="true">
              <div className="mini-card card-1">
                <span className="card-badge teal" />
                <div className="card-skeleton-title" />
                <div className="card-skeleton-num" />
              </div>
              <div className="mini-card card-2">
                <span className="card-badge blue" />
                <div className="card-skeleton-title" />
                <div className="card-skeleton-num" />
              </div>
              <div className="mini-card card-3">
                <span className="card-badge gold" />
                <div className="card-skeleton-title" />
                <div className="card-skeleton-num" />
              </div>
            </div>
            <div className="transition-copy">
              <span className="transition-kicker investor-kicker">DESTINATION: DEAL ROOM</span>
              <h2>Entering Syndicate Matrix.</h2>
              <p>Arranging deal catalog, private watchlist, and investor telemetry…</p>
            </div>
          </div>
        )}

        {/* 4. ADMIN TRANSITION: SLATE SECURITY LOCK VERIFICATION */}
        {workspace === 'admin' && (
          <div className="transition-anim-wrapper anim-admin">
            <div className="admin-lock-graphic" aria-hidden="true">
              <svg viewBox="0 0 100 100" className="admin-lock-svg" fill="none">
                <circle cx="50" cy="50" r="42" className="admin-lock-ring" />
                <circle cx="50" cy="50" r="34" className="admin-lock-pulse" />
                <path d="M50 25 L75 35 V55 C75 70 63 80 50 85 C37 80 25 70 25 55 V35 L50 25 Z" className="admin-shield" />
                <path d="M42 50 L48 56 L60 44" className="admin-check" />
              </svg>
            </div>
            <div className="transition-copy">
              <span className="transition-kicker admin-kicker">DESTINATION: OPERATIONAL CONTROL</span>
              <h2>Administrative Access Confirmed.</h2>
              <p>Opening moderation queues, historical registry, and system audit logs…</p>
            </div>
          </div>
        )}
      </div>

      <div className="transition-footer">
        <span className="transition-indicator-dot" />
        <span>Initializing destination shell…</span>
      </div>
    </div>
  );
};
