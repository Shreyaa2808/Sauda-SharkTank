import React, { useEffect, useRef } from 'react';
import type { Startup } from '../../types/startup.ts';
import {
  formatCurrency,
  formatEquity,
  formatPitchNumber,
  formatStageName,
  getSafeExternalUrl,
} from '../../utils/formatters.ts';

interface StartupDetailModalProps {
  startup: Startup | null;
  isOpen: boolean;
  onClose: () => void;
}

export const StartupDetailModal: React.FC<StartupDetailModalProps> = ({
  startup,
  isOpen,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Manage focus and scroll locking
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';

      // Move focus into the dialog's close button after paint
      const timer = setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !startup) {
    return null;
  }

  const location = [
    startup.headquartersCity,
    startup.headquartersState,
    startup.headquartersCountry,
  ]
    .filter(Boolean)
    .join(', ');

  const isPlatform = startup.pitchType === 'PLATFORM';
  const safeWebsiteUrl = getSafeExternalUrl(startup.websiteUrl);

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="startup-modal-title"
        aria-describedby="startup-modal-desc"
        className="startup-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="modal-topbar">
          <div className="modal-badges">
            <span
              className={`pitch-badge ${isPlatform ? 'platform' : 'show'}`}
            >
              <span className="badge-dot" />
              {isPlatform ? 'PLATFORM LISTING' : 'SHARK TANK SHOW'}
            </span>
            <span className="pitch-number">
              {formatPitchNumber(startup.pitchId)}
            </span>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close startup details"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-content">
          <div className="modal-header-section">
            <div className="company-monogram modal-monogram" aria-hidden="true">
              {startup.brandName.trim().charAt(0).toUpperCase() || 'S'}
            </div>
            <div>
              <h2 id="startup-modal-title" className="modal-title">
                {startup.brandName}
              </h2>
              {startup.legalBusinessName && (
                <p className="modal-legal-name">{startup.legalBusinessName}</p>
              )}
            </div>
          </div>

          <div className="modal-narrative-box">
            <span className="fact-label">PITCH OVERVIEW</span>
            <p id="startup-modal-desc" className="modal-hook">
              {startup.pitchHook ||
                'A venture navigating strategic growth, operational scaling, and investor collaboration.'}
            </p>
          </div>

          {/* Core Metrics Highlight Card */}
          <div className="modal-financials-card">
            <div className="financial-col">
              <span className="fact-label">ORIGINAL ASK</span>
              <strong className="financial-val tabular-nums">
                {formatCurrency(startup.originalAskAmount)}
              </strong>
            </div>

            <div className="financial-col">
              <span className="fact-label">REQUESTED EQUITY</span>
              <strong className="financial-val tabular-nums">
                {formatEquity(startup.originalAskEquityPct)}
              </strong>
            </div>

            {startup.foundedYear && (
              <div className="financial-col">
                <span className="fact-label">FOUNDED YEAR</span>
                <strong className="financial-val tabular-nums">
                  {startup.foundedYear}
                </strong>
              </div>
            )}
          </div>

          {/* Detailed Attributes Grid */}
          <div className="modal-attributes-grid">
            <div className="attribute-item">
              <span className="fact-label">INDUSTRY / SECTOR</span>
              <strong>{startup.industry || 'Not specified'}</strong>
            </div>

            <div className="attribute-item">
              <span className="fact-label">STARTUP STAGE</span>
              <strong>
                {formatStageName(startup.startupStage) || 'Not specified'}
              </strong>
            </div>

            <div className="attribute-item">
              <span className="fact-label">HEADQUARTERS</span>
              <strong>{location || 'Location not listed'}</strong>
            </div>

            <div className="attribute-item">
              <span className="fact-label">BUSINESS MODEL</span>
              <strong>{startup.businessModel || 'Not specified'}</strong>
            </div>
          </div>

          {/* External Verified Link */}
          {safeWebsiteUrl && (
            <div className="modal-website-section">
              <span className="fact-label">OFFICIAL WEBSITE</span>
              <a
                href={safeWebsiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="modal-website-link"
              >
                <span>{safeWebsiteUrl}</span>
                <span className="link-external-icon" aria-hidden="true">
                  ↗
                </span>
              </a>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <div className="modal-footer-note">
            <span className="modal-source-pill">
              Source: {isPlatform ? 'Sauda Registry' : 'Televised Broadcast Archive'}
            </span>
          </div>
          <button
            type="button"
            className="panel-btn modal-dismiss-btn"
            onClick={onClose}
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
