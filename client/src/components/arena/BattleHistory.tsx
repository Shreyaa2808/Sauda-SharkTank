import React from 'react';
import type { BattleAnalysisResult } from '../../types/arena';
import './BattleHistory.css';

interface BattleHistoryProps {
  battles: BattleAnalysisResult[];
  onSelectBattle: (battle: BattleAnalysisResult) => void;
  onNewBattle: () => void;
}

export const BattleHistory: React.FC<BattleHistoryProps> = ({
  battles,
  onSelectBattle,
  onNewBattle,
}) => {
  return (
    <div className="battle-history-view">
      <div className="history-header">
        <div>
          <span className="history-eyebrow">HISTORICAL DOSSIERS</span>
          <h2 className="history-heading">SAVED FOUNDER ARENA BATTLES</h2>
        </div>
        <button className="new-battle-btn" onClick={onNewBattle}>
          + LAUNCH NEW ARENA EVALUATION
        </button>
      </div>

      {battles.length === 0 ? (
        <div className="history-empty-state">
          <div className="empty-radar-icon">⎔</div>
          <h3>NO BATTLES RECORDED YET</h3>
          <p>
            You have not pitted your venture against investor contenders. Launch your first cinematic evaluation to
            generate a persistent strategic dossier.
          </p>
          <button className="launch-first-btn" onClick={onNewBattle}>
            START FIRST BATTLE &rarr;
          </button>
        </div>
      ) : (
        <div className="history-cards-grid">
          {battles.map((b) => (
            <div key={b.battleId} className="history-card" onClick={() => onSelectBattle(b)}>
              <div className="card-top">
                <span className="history-date">
                  {new Date(b.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className={`outcome-badge outcome-${b.outcomeType.toLowerCase()}`}>
                  {b.winnerInvestorId === b.investorA.investor.id
                    ? `${b.investorA.investor.name.split(' ')[0]} WON`
                    : b.winnerInvestorId === b.investorB.investor.id
                    ? `${b.investorB.investor.name.split(' ')[0]} WON`
                    : b.outcomeType}
                </span>
              </div>

              <h4 className="startup-title">{b.startup.name}</h4>
              <p className="sector-subtitle">{b.startup.sector} • {b.startup.stage}</p>

              {/* Head to Head mini strip */}
              <div className="mini-h2h-strip">
                <div className="h2h-side">
                  <span className="h2h-name">{b.investorA.investor.name}</span>
                  <span className="h2h-score">{Math.round(b.investorA.compatibilityScore)}%</span>
                </div>
                <span className="h2h-vs">VS</span>
                <div className="h2h-side">
                  <span className="h2h-name">{b.investorB.investor.name}</span>
                  <span className="h2h-score">{Math.round(b.investorB.compatibilityScore)}%</span>
                </div>
              </div>

              <div className="card-bottom">
                <span className="readiness-tag">READINESS: {Math.round(b.readiness.overallReadinessScore)}%</span>
                <span className="view-link">INSPECT REPORT &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
