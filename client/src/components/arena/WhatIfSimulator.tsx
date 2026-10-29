import React, { useState } from 'react';
import type { BattleAnalysisResult } from '../../types/arena';
import { runFounderBattleArena } from '../../services/arenaEngine';
import './WhatIfSimulator.css';

interface WhatIfSimulatorProps {
  battle: BattleAnalysisResult;
  onBackToResults: () => void;
  onApplyChanges?: (updatedBattle: BattleAnalysisResult) => void;
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({
  battle,
  onBackToResults,
  onApplyChanges,
}) => {
  // Simulator State: clones of base parameters
  const [hypoRaiseLakhs, setHypoRaiseLakhs] = useState<number>(battle.requirements.fundingAsk / 100000);
  const [hypoEquityPct, setHypoEquityPct] = useState<number>(battle.requirements.equityOfferedPct);
  const [hypoArrLakhs, setHypoArrLakhs] = useState<number>(battle.startup.arr ? battle.startup.arr / 100000 : 100);
  const [hypoGrossMarginPct, setHypoGrossMarginPct] = useState<number>(battle.startup.grossMarginPct || 70);
  const [hypoBurnLakhs, setHypoBurnLakhs] = useState<number>(battle.startup.monthlyBurn ? battle.startup.monthlyBurn / 100000 : 5);

  // Recalculate on-the-fly without corrupting original battle
  const simulatedStartup = {
    ...battle.startup,
    arr: hypoArrLakhs * 100000,
    grossMarginPct: hypoGrossMarginPct,
    monthlyBurn: hypoBurnLakhs * 100000,
  };

  const simulatedBlueprint = {
    ...battle.requirements,
    fundingAsk: hypoRaiseLakhs * 100000,
    equityOfferedPct: hypoEquityPct,
  };

  const simulatedResult = runFounderBattleArena(
    simulatedStartup,
    simulatedBlueprint,
    battle.investorA.investor,
    battle.investorB.investor
  );

  const baseScoreA = Math.round(battle.investorA.compatibilityScore);
  const baseScoreB = Math.round(battle.investorB.compatibilityScore);

  const simScoreA = Math.round(simulatedResult.investorA.compatibilityScore);
  const simScoreB = Math.round(simulatedResult.investorB.compatibilityScore);

  const deltaA = simScoreA - baseScoreA;
  const deltaB = simScoreB - baseScoreB;

  const preMoneyCr = simulatedResult.financialCalculations.impliedPreMoneyValuation
    ? (simulatedResult.financialCalculations.impliedPreMoneyValuation / 10000000).toFixed(2)
    : 'N/A';
  const postMoneyCr = simulatedResult.financialCalculations.impliedPostMoneyValuation
    ? (simulatedResult.financialCalculations.impliedPostMoneyValuation / 10000000).toFixed(2)
    : 'N/A';

  return (
    <div className="what-if-simulator-view">
      {/* Top Header */}
      <div className="sim-header">
        <button className="sim-back-btn" onClick={onBackToResults}>
          &larr; BACK TO RESULTS
        </button>

        <div className="sim-title-group">
          <span className="sim-eyebrow">WHAT-IF SENSITIVITY ENGINE</span>
          <h2 className="sim-title">HYPOTHETICAL DEAL SIMULATOR</h2>
          <p className="sim-sub">
            Adjust deal terms, revenue, and unit economics to immediately observe score migration in real time.
          </p>
        </div>

        {onApplyChanges && (
          <button className="sim-apply-btn" onClick={() => onApplyChanges(simulatedResult)}>
            LOCK SIMULATED TERMS
          </button>
        )}
      </div>

      {/* Main Grid: Controls vs Comparative Live Outputs */}
      <div className="sim-main-grid">
        {/* Controls Column */}
        <div className="sim-controls-card">
          <h3 className="controls-card-title">SIMULATED VARIABLES</h3>

          {/* Variable 1: Capital Raise */}
          <div className="sim-control-item">
            <div className="control-label-row">
              <span className="ctl-name">TARGET RAISE</span>
              <span className="ctl-val">₹{(hypoRaiseLakhs / 100).toFixed(2)} Cr</span>
            </div>
            <input
              type="range"
              min="20"
              max="2000"
              step="10"
              value={hypoRaiseLakhs}
              onChange={(e) => setHypoRaiseLakhs(Number(e.target.value))}
            />
            <div className="ctl-scale">
              <span>₹20L</span>
              <span>₹20Cr</span>
            </div>
          </div>

          {/* Variable 2: Offered Equity */}
          <div className="sim-control-item">
            <div className="control-label-row">
              <span className="ctl-name">OFFERED EQUITY</span>
              <span className="ctl-val">{hypoEquityPct}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="35"
              step="0.5"
              value={hypoEquityPct}
              onChange={(e) => setHypoEquityPct(Number(e.target.value))}
            />
            <div className="ctl-scale">
              <span>1%</span>
              <span>35%</span>
            </div>
          </div>

          {/* Variable 3: Annual Recurring Revenue */}
          <div className="sim-control-item">
            <div className="control-label-row">
              <span className="ctl-name">ANNUAL REVENUE (ARR)</span>
              <span className="ctl-val">₹{(hypoArrLakhs / 100).toFixed(2)} Cr</span>
            </div>
            <input
              type="range"
              min="0"
              max="2500"
              step="25"
              value={hypoArrLakhs}
              onChange={(e) => setHypoArrLakhs(Number(e.target.value))}
            />
            <div className="ctl-scale">
              <span>₹0</span>
              <span>₹25Cr</span>
            </div>
          </div>

          {/* Variable 4: Gross Margin */}
          <div className="sim-control-item">
            <div className="control-label-row">
              <span className="ctl-name">GROSS MARGIN</span>
              <span className="ctl-val">{hypoGrossMarginPct}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="95"
              step="1"
              value={hypoGrossMarginPct}
              onChange={(e) => setHypoGrossMarginPct(Number(e.target.value))}
            />
            <div className="ctl-scale">
              <span>10%</span>
              <span>95%</span>
            </div>
          </div>

          {/* Variable 5: Monthly Burn */}
          <div className="sim-control-item">
            <div className="control-label-row">
              <span className="ctl-name">MONTHLY BURN</span>
              <span className="ctl-val">₹{hypoBurnLakhs} Lakhs</span>
            </div>
            <input
              type="range"
              min="1"
              max="80"
              step="1"
              value={hypoBurnLakhs}
              onChange={(e) => setHypoBurnLakhs(Number(e.target.value))}
            />
            <div className="ctl-scale">
              <span>₹1L</span>
              <span>₹80L</span>
            </div>
          </div>
        </div>

        {/* Live Simulation Output Column */}
        <div className="sim-output-column">
          {/* Top Score Delta Cards */}
          <div className="sim-scores-row">
            {/* Contender A Score Delta */}
            <div className="sim-score-card">
              <span className="ssc-name">{battle.investorA.investor.name}</span>
              <div className="ssc-values">
                <span className="ssc-new">{simScoreA}%</span>
                <span className={`ssc-delta ${deltaA >= 0 ? 'pos' : 'neg'}`}>
                  {deltaA >= 0 ? `+${deltaA}%` : `${deltaA}%`}
                </span>
              </div>
              <span className="ssc-orig">Base was {baseScoreA}%</span>
            </div>

            {/* Contender B Score Delta */}
            <div className="sim-score-card">
              <span className="ssc-name">{battle.investorB.investor.name}</span>
              <div className="ssc-values">
                <span className="ssc-new">{simScoreB}%</span>
                <span className={`ssc-delta ${deltaB >= 0 ? 'pos' : 'neg'}`}>
                  {deltaB >= 0 ? `+${deltaB}%` : `${deltaB}%`}
                </span>
              </div>
              <span className="ssc-orig">Base was {baseScoreB}%</span>
            </div>
          </div>

          {/* New Implied Valuation Card */}
          <div className="sim-details-card">
            <span className="sdc-title">SIMULATED VALUATION TELEMETRY</span>
            <div className="sdc-grid">
              <div className="sdc-item">
                <span className="sdc-lbl">IMPLIED PRE-MONEY</span>
                <span className="sdc-val text-cyan">₹{preMoneyCr} Cr</span>
              </div>
              <div className="sdc-item">
                <span className="sdc-lbl">POST-MONEY</span>
                <span className="sdc-val">₹{postMoneyCr} Cr</span>
              </div>
              <div className="sdc-item">
                <span className="sdc-lbl">PROJECTED RUNWAY</span>
                <span className="sdc-val">{simulatedResult.financialCalculations.estimatedMonthsRunway ?? 18} Months</span>
              </div>
              <div className="sdc-item">
                <span className="sdc-lbl">CAPITAL EFFICIENCY</span>
                <span className="sdc-val">{simulatedResult.financialCalculations.capitalEfficiencyScore}/100</span>
              </div>
            </div>
          </div>

          {/* Simulated Match Verdict */}
          <div className="sim-verdict-box">
            <span className="svb-tag">SIMULATED OUTCOME</span>
            <h4 className="svb-winner">{simulatedResult.verdictHeadline}</h4>
            <p className="svb-explanation">{simulatedResult.verdictExplanation}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
