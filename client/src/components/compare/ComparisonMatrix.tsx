import React, { useEffect, useRef } from 'react';
import type { Startup } from '../../types/startup.ts';
import {
  formatCurrency,
  formatEquity,
  formatPitchNumber,
  formatStageName,
} from '../../utils/formatters.ts';

interface ComparisonMatrixProps {
  startups: Startup[];
  isOpen: boolean;
  onClose: () => void;
  onRemoveStartup?: (pitchId: number) => void;
}

export const ComparisonMatrix: React.FC<ComparisonMatrixProps> = ({
  startups,
  isOpen,
  onClose,
  onRemoveStartup,
}) => {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus management and body scroll locking
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';

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

  if (!isOpen || startups.length === 0) {
    return null;
  }

  const pitchType = startups[0]?.pitchType;
  const isPlatform = pitchType === 'PLATFORM';

  return (
    <div
      className="modal-backdrop matrix-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="matrix-title"
        className="comparison-matrix-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Matrix Header */}
        <div className="matrix-topbar">
          <div>
            <div className="matrix-eyebrow">
              <span className="eyebrow-line" />
              <span>SIDE-BY-SIDE EVALUATION</span>
            </div>
            <h2 id="matrix-title" className="matrix-heading">
              Comparing {startups.length} {isPlatform ? 'Platform Listings' : 'Show Pitches'}
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close comparison matrix"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Matrix Comparison Table / Grid */}
        <div className="matrix-scroll-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th className="matrix-attr-header" scope="col">
                  <span>METRIC / ATTRIBUTE</span>
                </th>
                {startups.map((startup) => (
                  <th
                    key={startup.pitchId}
                    className="matrix-col-header"
                    scope="col"
                  >
                    <div className="col-header-top">
                      <span className="pitch-number">
                        {formatPitchNumber(startup.pitchId)}
                      </span>
                      {onRemoveStartup && startups.length > 2 && (
                        <button
                          type="button"
                          className="matrix-col-remove"
                          onClick={() => onRemoveStartup(startup.pitchId)}
                          aria-label={`Remove ${startup.brandName} from comparison`}
                          title={`Remove ${startup.brandName}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="col-brand-lockup">
                      <div className="company-monogram matrix-monogram" aria-hidden="true">
                        {startup.brandName.trim().charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong className="col-brand-name">{startup.brandName}</strong>
                        {startup.legalBusinessName && (
                          <span className="col-legal-name">{startup.legalBusinessName}</span>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Source */}
              <tr>
                <th scope="row" className="matrix-attr-cell">
                  Pitch Source
                </th>
                {startups.map((s) => (
                  <td key={s.pitchId} className="matrix-data-cell">
                    <span
                      className={`pitch-badge ${
                        s.pitchType === 'PLATFORM' ? 'platform' : 'show'
                      }`}
                    >
                      <span className="badge-dot" />
                      {s.pitchType === 'PLATFORM'
                        ? 'PLATFORM LISTING'
                        : 'SHARK TANK SHOW'}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Row 2: Original Ask */}
              <tr className="highlight-row">
                <th scope="row" className="matrix-attr-cell">
                  Original Ask
                </th>
                {startups.map((s) => (
                  <td key={s.pitchId} className="matrix-data-cell">
                    <strong className="matrix-ask-val tabular-nums">
                      {formatCurrency(s.originalAskAmount)}
                    </strong>
                  </td>
                ))}
              </tr>

              {/* Row 3: Requested Equity */}
              <tr className="highlight-row">
                <th scope="row" className="matrix-attr-cell">
                  Requested Equity
                </th>
                {startups.map((s) => (
                  <td key={s.pitchId} className="matrix-data-cell">
                    <strong className="matrix-equity-val tabular-nums">
                      {formatEquity(s.originalAskEquityPct)}
                    </strong>
                  </td>
                ))}
              </tr>

              {/* Row 4: Industry */}
              <tr>
                <th scope="row" className="matrix-attr-cell">
                  Industry / Sector
                </th>
                {startups.map((s) => (
                  <td key={s.pitchId} className="matrix-data-cell">
                    <span className="info-tag">
                      {s.industry || 'Not specified'}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Row 5: Stage */}
              <tr>
                <th scope="row" className="matrix-attr-cell">
                  Startup Stage
                </th>
                {startups.map((s) => (
                  <td key={s.pitchId} className="matrix-data-cell">
                    {s.startupStage ? (
                      <span className="info-tag stage-tag">
                        {formatStageName(s.startupStage)}
                      </span>
                    ) : (
                      <span className="text-muted">Not specified</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Row 6: Location */}
              <tr>
                <th scope="row" className="matrix-attr-cell">
                  Headquarters
                </th>
                {startups.map((s) => {
                  const loc = [s.headquartersCity, s.headquartersState, s.headquartersCountry]
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <td key={s.pitchId} className="matrix-data-cell">
                      <span>{loc || 'Location not listed'}</span>
                    </td>
                  );
                })}
              </tr>

              {/* Row 7: Business Model */}
              <tr>
                <th scope="row" className="matrix-attr-cell">
                  Business Model
                </th>
                {startups.map((s) => (
                  <td key={s.pitchId} className="matrix-data-cell">
                    <span>{s.businessModel || 'Not specified'}</span>
                  </td>
                ))}
              </tr>

              {/* Row 8: Founded */}
              <tr>
                <th scope="row" className="matrix-attr-cell">
                  Founded Year
                </th>
                {startups.map((s) => (
                  <td key={s.pitchId} className="matrix-data-cell">
                    <span className="tabular-nums">
                      {s.foundedYear || 'Not specified'}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Row 9: Narrative / Hook */}
              <tr>
                <th scope="row" className="matrix-attr-cell">
                  Pitch Hook
                </th>
                {startups.map((s) => (
                  <td key={s.pitchId} className="matrix-data-cell pitch-hook-cell">
                    <p className="matrix-hook-text">
                      {s.pitchHook || 'No hook summary provided.'}
                    </p>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Matrix Footer */}
        <div className="matrix-footer">
          <div className="matrix-footer-note">
            <span className="data-note-mark" aria-hidden="true">
              i
            </span>
            <span>
              All values shown are genuine records from the Sauda database. Strict source separation is enforced.
            </span>
          </div>

          <button
            type="button"
            className="panel-btn"
            onClick={onClose}
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
