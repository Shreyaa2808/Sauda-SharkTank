import React, { useEffect, useRef, useState } from 'react';
import type { Startup } from '../../types/startup.ts';
import type { ComparisonItem } from '../../types/historical.ts';
import { compareStartupsApi } from '../../services/historical.ts';
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

  const [serverData, setServerData] = useState<ComparisonItem[] | null>(null);
  const [serverSource, setServerSource] = useState<'SHOW' | 'PLATFORM' | null>(null);
  const [loadingServer, setLoadingServer] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);

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

  // Fetch authoritative comparison data from POST /api/startups/compare
  useEffect(() => {
    if (!isOpen || startups.length < 2) {
      return;
    }

    const controller = new AbortController();
    const companyIds = startups.map((s) => s.companyId);

    void (async () => {
      setLoadingServer(true);
      setServerError(null);
      try {
        const res = await compareStartupsApi(companyIds, controller.signal);
        if (!controller.signal.aborted) {
          setServerData(res.items);
          setServerSource(res.sourceType);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setServerError(err instanceof Error ? err.message : 'Failed to retrieve authoritative comparison.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingServer(false);
        }
      }
    })();

    return () => controller.abort();
  }, [isOpen, startups]);

  if (!isOpen || startups.length === 0) {
    return null;
  }

  // Derive comparison list: prefer authoritative server rows when available; fall back to client props
  const displayItems: Array<{
    pitchId: number;
    companyId: number;
    brandName: string;
    legalBusinessName: string | null;
    pitchType: 'SHOW' | 'PLATFORM';
    originalAskAmount: number | string | null;
    originalAskEquityPct: number | string | null;
    industry: string | null;
    startupStage: string | null;
    headquartersCity: string | null;
    headquartersState: string | null;
    headquartersCountry: string | null;
    businessModel: string | null;
    foundedYear: number | null;
    pitchHook: string | null;
  }> = serverData && serverData.length === startups.length
    ? serverData.map((item) => ({
        pitchId: item.pitchId,
        companyId: item.companyId,
        brandName: item.brandName,
        legalBusinessName: item.legalBusinessName,
        pitchType: (serverSource ?? (item.sourceTypes.includes('SHOW') ? 'SHOW' : 'PLATFORM')) as 'SHOW' | 'PLATFORM',
        originalAskAmount: item.originalAskAmount,
        originalAskEquityPct: item.originalAskEquityPct,
        industry: item.industry,
        startupStage: item.startupStage,
        headquartersCity: item.headquartersCity,
        headquartersState: item.headquartersState,
        headquartersCountry: item.headquartersCountry,
        businessModel: item.businessModel,
        foundedYear: item.foundedYear,
        pitchHook: item.pitchHook,
      }))
    : startups.map((s) => ({
        pitchId: s.pitchId,
        companyId: s.companyId,
        brandName: s.brandName,
        legalBusinessName: s.legalBusinessName,
        pitchType: s.pitchType,
        originalAskAmount: s.originalAskAmount,
        originalAskEquityPct: s.originalAskEquityPct,
        industry: s.industry,
        startupStage: s.startupStage,
        headquartersCity: s.headquartersCity,
        headquartersState: s.headquartersState,
        headquartersCountry: s.headquartersCountry,
        businessModel: s.businessModel,
        foundedYear: s.foundedYear,
        pitchHook: s.pitchHook,
      }));

  const pitchType = displayItems[0]?.pitchType ?? startups[0]?.pitchType;
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
              {serverData && (
                <span className="matrix-server-badge" style={{
                  marginLeft: '8px',
                  background: 'rgba(217, 119, 6, 0.2)',
                  color: '#FBBF24',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.5px'
                }}>
                  AUTHORITATIVE DB COMPARISON
                </span>
              )}
            </div>
            <h2 id="matrix-title" className="matrix-heading">
              Comparing {displayItems.length} {isPlatform ? 'Platform Listings' : 'Show Pitches'}
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

        {/* Server State Notice */}
        {loadingServer && (
          <div style={{
            padding: '8px 24px',
            background: '#F0F9FF',
            borderBottom: '1px solid #BAE6FD',
            fontSize: '12px',
            color: '#0369A1',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#0284C7' }} />
            <span>Fetching authoritative comparison from server…</span>
          </div>
        )}

        {serverError && (
          <div style={{
            padding: '8px 24px',
            background: '#FEF2F2',
            borderBottom: '1px solid #FECACA',
            fontSize: '12px',
            color: '#B91C1C',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠</span>
            <span>Server verification note: {serverError} (Showing cached venture data)</span>
          </div>
        )}

        {/* Matrix Comparison Table / Grid */}
        <div className="matrix-scroll-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th className="matrix-attr-header" scope="col">
                  <span>METRIC / ATTRIBUTE</span>
                </th>
                {displayItems.map((item) => (
                  <th
                    key={item.pitchId}
                    className="matrix-col-header"
                    scope="col"
                  >
                    <div className="col-header-top">
                      <span className="pitch-number">
                        {formatPitchNumber(item.pitchId)}
                      </span>
                      {onRemoveStartup && displayItems.length > 2 && (
                        <button
                          type="button"
                          className="matrix-col-remove"
                          onClick={() => onRemoveStartup(item.pitchId)}
                          aria-label={`Remove ${item.brandName} from comparison`}
                          title={`Remove ${item.brandName}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="col-brand-lockup">
                      <div className="company-monogram matrix-monogram" aria-hidden="true">
                        {item.brandName.trim().charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong className="col-brand-name">{item.brandName}</strong>
                        {item.legalBusinessName && (
                          <span className="col-legal-name">{item.legalBusinessName}</span>
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
                {displayItems.map((s) => (
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
                {displayItems.map((s) => (
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
                {displayItems.map((s) => (
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
                {displayItems.map((s) => (
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
                {displayItems.map((s) => (
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
                {displayItems.map((s) => {
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
                {displayItems.map((s) => (
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
                {displayItems.map((s) => (
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
                {displayItems.map((s) => (
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
