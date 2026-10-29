import React from 'react';
import type { InvestorProfile } from '../../types/arena';
import './HolographicCompany.css';

interface HolographicCompanyProps {
  investor: InvestorProfile;
  side: 'left' | 'right';
  score?: number;
  isWinner?: boolean;
  isAnalyzing?: boolean;
}

export const HolographicCompany: React.FC<HolographicCompanyProps> = ({
  investor,
  side,
  score,
  isWinner = false,
  isAnalyzing = false,
}) => {
  const brandColor = investor.accentColor || (side === 'left' ? '#00D8F6' : '#2CD3E1');
  const accentGlow = isWinner ? '#10B981' : brandColor;

  const ticketMinCr = (investor.minInvestment / 10000000).toFixed(1);
  const ticketMaxCr = (investor.maxInvestment / 10000000).toFixed(1);

  return (
    <div
      className={`holo-company-wrap holo-${side} ${isWinner ? 'is-winner' : ''} ${isAnalyzing ? 'is-analyzing' : ''}`}
      style={{
        '--holo-accent': accentGlow,
        '--holo-base': brandColor,
      } as React.CSSProperties}
    >
      {/* 3D Holographic Tower Monolith */}
      <div className="holo-tower-monolith">
        {/* Hologram Scanlines & Energy Grid Layer */}
        <div className="holo-grid-overlay" />
        <div className="holo-scanline" />
        <div className="holo-ambient-flare" />

        {/* Top Header / Status Indicators */}
        <div className="holo-top-bar">
          <span className="holo-slot-tag">CONTENDER {side === 'left' ? 'A' : 'B'}</span>
          <span className="holo-status-pill">
            <span className="holo-live-dot" />
            {investor.verified ? 'VERIFIED FIRM' : 'INDEXED'}
          </span>
        </div>

        {/* Brand Icon / Logo Center */}
        <div className="holo-brand-section">
          <div className="holo-logo-box">
            <span className="holo-logo-letter">{investor.logoText || investor.name.charAt(0)}</span>
            <div className="holo-logo-orbit" />
          </div>

          <h2 className="holo-company-name">{investor.name}</h2>
          <p className="holo-company-type">{investor.firmName} • {investor.category.replace('_', ' ')}</p>
        </div>

        {/* Investment Focus & Ticket Size */}
        <div className="holo-meta-row">
          <div className="holo-meta-item">
            <span className="holo-meta-lbl">TICKET RANGE</span>
            <span className="holo-meta-val">
              ₹{ticketMinCr}Cr - ₹{ticketMaxCr}Cr
            </span>
          </div>
          <div className="holo-meta-item">
            <span className="holo-meta-lbl">TYPICAL CHECK</span>
            <span className="holo-meta-val">₹{(investor.typicalCheckSize / 10000000).toFixed(1)}Cr</span>
          </div>
        </div>

        {/* Stage & Target Alignment Chips */}
        <div className="holo-sectors-row">
          <span className="holo-sec-title">TARGET SECTORS</span>
          <div className="holo-chips">
            {investor.preferredSectors.slice(0, 3).map((sec) => (
              <span key={sec} className="holo-chip">{sec}</span>
            ))}
          </div>
        </div>

        {/* Animated Bar Telemetry (Matching Reference Images 1 & 2) */}
        <div className="holo-telemetry-block">
          <div className="holo-telemetry-header">
            <span>ALIGNMENT METRICS</span>
            <span className="holo-telemetry-val">
              {score !== undefined ? `${Math.round(score)}%` : 'CALCULATING...'}
            </span>
          </div>

          <div className="holo-bar-group">
            <div className="holo-bar-item">
              <span className="holo-bar-lbl">SECTOR FIT</span>
              <div className="holo-bar-track">
                <div
                  className="holo-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(25, (score !== undefined ? score * 0.95 : 75)))}%` }}
                />
              </div>
            </div>

            <div className="holo-bar-item">
              <span className="holo-bar-lbl">STAGE SYNERGY</span>
              <div className="holo-bar-track">
                <div
                  className="holo-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(20, (investor.preferredStages.length * 28)))}%` }}
                />
              </div>
            </div>

            <div className="holo-bar-item">
              <span className="holo-bar-lbl">CAPITAL MATCH</span>
              <div className="holo-bar-track">
                <div className="holo-bar-fill" style={{ width: `${Math.min(100, Math.max(30, (score !== undefined ? score * 0.9 : 82)))}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Radial Index Meter (Inspired by Circular Gauges in Ref 1 & 2) */}
        <div className="holo-circular-gauge-box">
          <div className="holo-gauge-ring">
            <svg viewBox="0 0 80 80" className="holo-svg-ring">
              <circle cx="40" cy="40" r="32" className="holo-ring-bg" />
              <circle
                cx="40"
                cy="40"
                r="32"
                className="holo-ring-fill"
                strokeDasharray="201"
                strokeDashoffset={score !== undefined ? 201 - (201 * score) / 100 : 80}
              />
            </svg>
            <div className="holo-gauge-inner">
              <span className="holo-gauge-num">{score !== undefined ? `${Math.round(score)}%` : '--'}</span>
              <span className="holo-gauge-lbl">SCORE</span>
            </div>
          </div>
          <div className="holo-gauge-summary">
            <span className="holo-gauge-geo">GEO: {investor.geographicFocus.join(', ')}</span>
            <span className="holo-gauge-thesis">{investor.investmentThesis.slice(0, 55)}...</span>
          </div>
        </div>

        {/* Winner Aura / Status Badge */}
        {isWinner && (
          <div className="holo-winner-badge">
            <div className="holo-winner-star">&#10003;</div>
            <span>MATCH LEADER</span>
          </div>
        )}
      </div>

      {/* Holographic Stand / Reflective Floor Pedestal */}
      <div className="holo-pedestal">
        <div className="holo-pedestal-core" />
        <div className="holo-pedestal-ring ring-1" />
        <div className="holo-pedestal-ring ring-2" />
        <div className="holo-pedestal-glow" />
      </div>
    </div>
  );
};
