import React from 'react';
import type { BattleAnalysisResult } from '../../types/arena';
import './CentralAnalytics.css';

interface CentralAnalyticsProps {
  battle: BattleAnalysisResult;
}

export const CentralAnalytics: React.FC<CentralAnalyticsProps> = ({
  battle,
}) => {
  const { investorA, investorB, financialCalculations, readiness } = battle;

  const scoreA = Math.round(investorA.compatibilityScore);
  const scoreB = Math.round(investorB.compatibilityScore);

  // Extract funding capacity and sector scores
  const fundingScoreA = investorA.criteriaScores.find((c) => c.key === 'fundingCompatibility')?.score || 75;
  const fundingScoreB = investorB.criteriaScores.find((c) => c.key === 'fundingCompatibility')?.score || 70;

  const sectorScoreA = investorA.criteriaScores.find((c) => c.key === 'sectorAlignment')?.score || 80;
  const sectorScoreB = investorB.criteriaScores.find((c) => c.key === 'sectorAlignment')?.score || 75;

  const preMoneyCr = financialCalculations.impliedPreMoneyValuation
    ? (financialCalculations.impliedPreMoneyValuation / 10000000).toFixed(2)
    : 'N/A';

  return (
    <div className="central-analytics-card">
      {/* Corner Cyber Accents */}
      <div className="analytics-corner top-left" />
      <div className="analytics-corner top-right" />
      <div className="analytics-corner bottom-left" />
      <div className="analytics-corner bottom-right" />

      {/* Top Banner / Heading */}
      <div className="analytics-header">
        <div className="analytics-tag-row">
          <span className="live-telemetry-tag">
            <span className="live-dot" /> LIVE ENGINE TELEMETRY
          </span>
          <span className="data-coverage-tag">
            COVERAGE: {Math.round(investorA.dataCoveragePct)}%
          </span>
        </div>
        <h3 className="analytics-main-title">STRATEGIC FIT & CAPITAL ALLOCATION</h3>
      </div>

      {/* Row 1: Investment Capacity Comparison (Matching Reference Image 2) */}
      <div className="analytics-section">
        <div className="section-label-row">
          <span className="section-title">INVESTMENT CAPACITY ALIGNMENT</span>
          <span className="section-subtext">ASK vs TICKET CAPACITY</span>
        </div>
        
        <div className="capacity-bars">
          {/* Contender A Bar */}
          <div className="capacity-bar-row">
            <span className="capacity-name">{investorA.investor.name}</span>
            <div className="capacity-track">
              <div
                className="capacity-fill fill-cyan"
                style={{ width: `${Math.min(100, Math.max(10, fundingScoreA))}%` }}
              />
              <span className="capacity-marker" style={{ left: '65%' }}>ASK</span>
            </div>
            <span className="capacity-score">{Math.round(fundingScoreA)}%</span>
          </div>

          {/* Contender B Bar */}
          <div className="capacity-bar-row">
            <span className="capacity-name">{investorB.investor.name}</span>
            <div className="capacity-track">
              <div
                className="capacity-fill fill-teal"
                style={{ width: `${Math.min(100, Math.max(10, fundingScoreB))}%` }}
              />
              <span className="capacity-marker" style={{ left: '65%' }}>ASK</span>
            </div>
            <span className="capacity-score">{Math.round(fundingScoreB)}%</span>
          </div>
        </div>
      </div>

      {/* Row 2: Mid Analytics Grid (Market Status + Asset Value Metrics from Ref Image 2) */}
      <div className="analytics-mid-grid">
        {/* Left Sub-panel: Sector & Stage Fit */}
        <div className="mid-sub-panel">
          <div className="sub-panel-title">SECTOR & STAGE STATUS</div>
          <div className="dual-metric-row">
            <div className="dual-metric-box">
              <span className="dual-box-lbl">CONTENDER A FIT</span>
              <span className="dual-box-val text-cyan">
                {Math.round(sectorScoreA)}%
              </span>
              <span className="dual-box-desc">{investorA.investor.name.split(' ')[0]}</span>
            </div>

            <div className="dual-metric-box">
              <span className="dual-box-lbl">CONTENDER B FIT</span>
              <span className="dual-box-val text-teal">
                {Math.round(sectorScoreB)}%
              </span>
              <span className="dual-box-desc">{investorB.investor.name.split(' ')[0]}</span>
            </div>
          </div>

          {/* Traction and Runway Indicators */}
          <div className="sub-metrics-list">
            <div className="sub-metric-item">
              <span className="sub-metric-lbl">ESTIMATED RUNWAY</span>
              <span className="sub-metric-val">{financialCalculations.estimatedMonthsRunway ?? 18} MONTHS</span>
            </div>
            <div className="sub-metric-item">
              <span className="sub-metric-lbl">PRE-MONEY VALUATION</span>
              <span className="sub-metric-val">₹{preMoneyCr} CR</span>
            </div>
            <div className="sub-metric-item">
              <span className="sub-metric-lbl">CAPITAL EFFICIENCY</span>
              <span className="sub-metric-val text-cyan">{financialCalculations.capitalEfficiencyScore}/100</span>
            </div>
          </div>
        </div>

        {/* Right Sub-panel: Circular Metric Gauges (Reference Image 2) */}
        <div className="mid-sub-panel gauges-panel">
          <div className="sub-panel-title">PORTFOLIO SYNERGY & READINESS</div>
          <div className="circular-gauges-row">
            {/* Gauge 1: Investment Readiness */}
            <div className="analytics-gauge">
              <div className="svg-gauge-wrap">
                <svg viewBox="0 0 70 70" className="gauge-svg">
                  <circle cx="35" cy="35" r="28" className="gauge-bg" />
                  <circle
                    cx="35"
                    cy="35"
                    r="28"
                    className="gauge-progress gauge-cyan"
                    strokeDasharray="176"
                    strokeDashoffset={176 - (176 * readiness.overallReadinessScore) / 100}
                  />
                </svg>
                <div className="gauge-text">
                  <span className="gauge-pct">{Math.round(readiness.overallReadinessScore)}%</span>
                  <span className="gauge-lbl">READINESS</span>
                </div>
              </div>
              <span className="gauge-caption">STARTUP INDEX</span>
            </div>

            {/* Gauge 2: Contender Delta */}
            <div className="analytics-gauge">
              <div className="svg-gauge-wrap">
                <svg viewBox="0 0 70 70" className="gauge-svg">
                  <circle cx="35" cy="35" r="28" className="gauge-bg" />
                  <circle
                    cx="35"
                    cy="35"
                    r="28"
                    className="gauge-progress gauge-gold"
                    strokeDasharray="176"
                    strokeDashoffset={176 - (176 * Math.max(scoreA, scoreB)) / 100}
                  />
                </svg>
                <div className="gauge-text">
                  <span className="gauge-pct">{Math.max(scoreA, scoreB)}%</span>
                  <span className="gauge-lbl">TOP MATCH</span>
                </div>
              </div>
              <span className="gauge-caption">COMPATIBILITY</span>
            </div>
          </div>

          {/* Bar histogram / mini sparklines */}
          <div className="sparkline-bar-group">
            <span className="sparkline-lbl">FINANCIAL COHESION MULTIPLIER</span>
            <div className="mini-bars-container">
              {[40, 65, 80, 55, 90, 75, 88, 95, 70, 85].map((val, idx) => (
                <div
                  key={idx}
                  className="mini-bar"
                  style={{ height: `${val}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Direct Head-to-Head Alignment Breakdown */}
      <div className="analytics-bottom-table">
        <div className="table-header-row">
          <span>CRITERION</span>
          <span>{investorA.investor.name.split(' ')[0]}</span>
          <span>DELTA</span>
          <span>{investorB.investor.name.split(' ')[0]}</span>
        </div>

        {investorA.criteriaScores.slice(0, 3).map((crit) => {
          const matchingB = investorB.criteriaScores.find((c) => c.key === crit.key)?.score || 0;
          const diff = Math.round(crit.score - matchingB);
          return (
            <div key={crit.key} className="table-data-row">
              <span className="cat-name">{crit.name}</span>
              <span className="cat-val text-cyan">{Math.round(crit.score)}%</span>
              <span className="cat-diff">
                {diff >= 0 ? `+${diff}%` : `${diff}%`}
              </span>
              <span className="cat-val text-teal">{Math.round(matchingB)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
