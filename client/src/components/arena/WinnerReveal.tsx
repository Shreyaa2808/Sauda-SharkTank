import React from 'react';
import type { BattleAnalysisResult } from '../../types/arena';
import './WinnerReveal.css';

interface WinnerRevealProps {
  battle: BattleAnalysisResult;
  onOpenImprovementLab: () => void;
  onOpenSimulator: () => void;
  onBackToArena: () => void;
}

export const WinnerReveal: React.FC<WinnerRevealProps> = ({
  battle,
  onOpenImprovementLab,
  onOpenSimulator,
  onBackToArena,
}) => {
  const { investorA, investorB, outcomeType, winnerInvestorId, verdictExplanation, financialCalculations, readiness } = battle;

  const isTie = outcomeType === 'NEAR_TIE';
  const isNeither = outcomeType === 'NEITHER_SUITABLE';

  const winnerEvaluation = winnerInvestorId === investorA.investor.id ? investorA : winnerInvestorId === investorB.investor.id ? investorB : null;
  const runnerUpEvaluation = winnerEvaluation?.investor.id === investorA.investor.id ? investorB : investorA;

  const scoreWinner = winnerEvaluation ? Math.round(winnerEvaluation.compatibilityScore) : Math.round(investorA.compatibilityScore);
  const scoreAlt = runnerUpEvaluation ? Math.round(runnerUpEvaluation.compatibilityScore) : Math.round(investorB.compatibilityScore);
  const delta = Math.abs(scoreWinner - scoreAlt);

  const preMoneyCr = financialCalculations.impliedPreMoneyValuation
    ? (financialCalculations.impliedPreMoneyValuation / 10000000).toFixed(2)
    : 'N/A';
  const postMoneyCr = financialCalculations.impliedPostMoneyValuation
    ? (financialCalculations.impliedPostMoneyValuation / 10000000).toFixed(2)
    : 'N/A';

  const activeInvestor = winnerEvaluation || investorA;
  const fundingScore = activeInvestor.criteriaScores.find((c) => c.key === 'fundingCompatibility')?.score || 70;
  const sectorScore = activeInvestor.criteriaScores.find((c) => c.key === 'sectorAlignment')?.score || 75;
  const stageScore = activeInvestor.criteriaScores.find((c) => c.key === 'stageCompatibility')?.score || 80;

  return (
    <div className="winner-reveal-overlay">
      {/* Volumetric Spotlights (Matching Ref 3 & 4) */}
      <div className="spotlight spotlight-left" />
      <div className="spotlight spotlight-center" />
      <div className="spotlight spotlight-right" />

      {/* Main Container */}
      <div className="winner-content-wrap">
        {/* Navigation Bar */}
        <div className="winner-top-nav">
          <button className="nav-ghost-btn" onClick={onBackToArena}>
            &larr; BACK TO 3D ARENA
          </button>
          <div className="eval-time-tag">
            EVALUATION COMPLETED • {new Date(battle.timestamp).toLocaleDateString()}
          </div>
          <div className="action-buttons-top">
            <button className="nav-action-btn secondary" onClick={onOpenSimulator}>
              WHAT-IF SIMULATOR
            </button>
            <button className="nav-action-btn primary" onClick={onOpenImprovementLab}>
              IMPROVEMENT LAB &rarr;
            </button>
          </div>
        </div>

        {/* Central Winner Banner (Matching Reference Image 3) */}
        <div className="winner-hero-box">
          {/* Cybernetic Checkmark Plaque (Prominent Checkmark as in Ref 3 & 4) */}
          <div className="winner-badge-cluster">
            <div className="cyber-check-frame">
              <svg viewBox="0 0 100 100" className="check-svg">
                <path
                  d="M 28 52 L 44 68 L 74 34"
                  fill="none"
                  stroke={isNeither ? '#ef4444' : '#10b981'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="winner-title-group">
              <span className="winner-eyebrow">
                {isTie ? 'PARALLEL SYNERGY' : isNeither ? 'HARD CONSTRAINT COLLISION' : 'OPTIMAL INVESTOR MATCH'}
              </span>
              <h1 className="winner-investor-name">
                {winnerEvaluation ? winnerEvaluation.investor.name : isNeither ? 'Neither Firm Suitable' : 'Contenders Tied'}
              </h1>
              <p className="winner-tagline">
                {winnerEvaluation
                  ? `${winnerEvaluation.investor.investmentThesis.slice(0, 85)}...`
                  : 'Critical ticket, sector, or stage parameters conflict with current requirements.'}
              </p>
            </div>
          </div>

          {/* Quick Head-to-Head Comparison Score Badges */}
          <div className="winner-scores-cluster">
            <div className="score-pillar winner-pillar">
              <span className="pillar-rank">{isTie ? 'CONTENDER A' : 'MATCH WINNER'}</span>
              <span className="pillar-score">{scoreWinner}%</span>
              <span className="pillar-name">{winnerEvaluation ? winnerEvaluation.investor.name : investorA.investor.name}</span>
            </div>

            <div className="score-pillar-divider">
              <span className="delta-val">+{delta}%</span>
              <span className="delta-lbl">DELTA</span>
            </div>

            <div className="score-pillar alt-pillar">
              <span className="pillar-rank">{isTie ? 'CONTENDER B' : 'RUNNER UP'}</span>
              <span className="pillar-score">{scoreAlt}%</span>
              <span className="pillar-name">{runnerUpEvaluation.investor.name}</span>
            </div>
          </div>
        </div>

        {/* Multi-Column Data Visualization Dashboard (Inspired by Ref Image 3) */}
        <div className="winner-dashboard-grid">
          {/* Column 1: Financial & Investment Capacity Bar Telemetry */}
          <div className="dashboard-card telemetry-card">
            <div className="card-header">
              <span className="card-tag">FINANCIAL COMPATIBILITY</span>
              <span className="card-score-sub">{scoreWinner}% COMPATIBLE</span>
            </div>

            <div className="data-bars-list">
              <div className="data-bar-item">
                <div className="data-bar-header">
                  <span>FUNDING CAPACITY</span>
                  <span className="data-bar-num">{Math.round(fundingScore)}%</span>
                </div>
                <div className="data-bar-track">
                  <div
                    className="data-bar-fill fill-green"
                    style={{ width: `${Math.round(fundingScore)}%` }}
                  />
                </div>
              </div>

              <div className="data-bar-item">
                <div className="data-bar-header">
                  <span>SECTOR ALIGNMENT</span>
                  <span className="data-bar-num">{Math.round(sectorScore)}%</span>
                </div>
                <div className="data-bar-track">
                  <div
                    className="data-bar-fill fill-cyan"
                    style={{ width: `${Math.round(sectorScore)}%` }}
                  />
                </div>
              </div>

              <div className="data-bar-item">
                <div className="data-bar-header">
                  <span>STAGE FOCUS</span>
                  <span className="data-bar-num">{Math.round(stageScore)}%</span>
                </div>
                <div className="data-bar-track">
                  <div
                    className="data-bar-fill fill-cyan"
                    style={{ width: `${Math.round(stageScore)}%` }}
                  />
                </div>
              </div>

              <div className="data-bar-item">
                <div className="data-bar-header">
                  <span>CAPITAL EFFICIENCY FIT</span>
                  <span className="data-bar-num">
                    {financialCalculations.capitalEfficiencyScore}%
                  </span>
                </div>
                <div className="data-bar-track">
                  <div
                    className="data-bar-fill fill-gold"
                    style={{ width: `${financialCalculations.capitalEfficiencyScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Implied Financial Multipliers */}
            <div className="financial-mini-stats">
              <div className="f-stat">
                <span className="f-lbl">PRE-MONEY</span>
                <span className="f-val">₹{preMoneyCr}Cr</span>
              </div>
              <div className="f-stat">
                <span className="f-lbl">POST-MONEY</span>
                <span className="f-val">₹{postMoneyCr}Cr</span>
              </div>
              <div className="f-stat">
                <span className="f-lbl">EST. RUNWAY</span>
                <span className="f-val">{financialCalculations.estimatedMonthsRunway ?? 18} Mo</span>
              </div>
            </div>
          </div>

          {/* Column 2: Rationale & Decision Evidence */}
          <div className="dashboard-card rationale-card">
            <div className="card-header">
              <span className="card-tag">MATCH RATIONALE & SYNERGY</span>
              <span className="confidence-pill">{activeInvestor.confidence} CONFIDENCE</span>
            </div>

            <p className="rationale-text">{verdictExplanation}</p>

            {/* Strengths & Limitations Split */}
            <div className="strengths-weakness-grid">
              <div className="sw-column strengths">
                <span className="sw-title">&#10003; KEY ADVANTAGES</span>
                <ul className="sw-list">
                  {activeInvestor.strongestMatches.slice(0, 3).map((str: string, idx: number) => (
                    <li key={idx}>{str}</li>
                  ))}
                </ul>
              </div>

              <div className="sw-column limitations">
                <span className="sw-title">&#9888; CRITICAL GAPS</span>
                <ul className="sw-list">
                  {activeInvestor.keyMismatches.slice(0, 3).map((lim: string, idx: number) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Column 3: Startup Investment Readiness Index */}
          <div className="dashboard-card readiness-card">
            <div className="card-header">
              <span className="card-tag">INVESTMENT READINESS</span>
              <span className="readiness-level-pill">
                {readiness.overallReadinessScore >= 80 ? 'PRIME' : readiness.overallReadinessScore >= 60 ? 'DEVELOPING' : 'EARLY'}
              </span>
            </div>

            {/* Category Scores */}
            <div className="readiness-meters-row">
              {readiness.categories.slice(0, 3).map((cat) => (
                <div key={cat.category} className="readiness-gauge">
                  <svg viewBox="0 0 60 60" className="r-svg">
                    <circle cx="30" cy="30" r="24" className="r-bg" />
                    <circle
                      cx="30"
                      cy="30"
                      r="24"
                      className="r-fill"
                      strokeDasharray="150"
                      strokeDashoffset={150 - (150 * cat.score) / 100}
                    />
                  </svg>
                  <span className="r-pct">{Math.round(cat.score)}%</span>
                  <span className="r-lbl">{cat.category.slice(0, 8)}</span>
                </div>
              ))}
            </div>

            {/* Improvement Lab Prompt */}
            <div className="improvement-prompt-box">
              <div className="prompt-left">
                <span className="prompt-count">{battle.improvementPlan.length} HIGH-PRIORITY GAPS</span>
                <span className="prompt-sub">Addressing these can lift compatibility up to +18%</span>
              </div>
              <button className="prompt-btn" onClick={onOpenImprovementLab}>
                OPEN LAB &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
