import React from 'react';
import type { BattleAnalysisResult } from '../../types/arena';
import { HolographicCompany } from './HolographicCompany';
import { CentralAnalytics } from './CentralAnalytics';
import './ArenaScene.css';

interface ArenaSceneProps {
  battle: BattleAnalysisResult;
  onProceedToReveal: () => void;
  onModifyPitch: () => void;
}

export const ArenaScene: React.FC<ArenaSceneProps> = ({
  battle,
  onProceedToReveal,
  onModifyPitch,
}) => {
  const { investorA, investorB, outcomeType, winnerInvestorId } = battle;

  const isWinnerA = outcomeType === 'DECISIVE_WINNER' && winnerInvestorId === investorA.investor.id;
  const isWinnerB = outcomeType === 'DECISIVE_WINNER' && winnerInvestorId === investorB.investor.id;

  return (
    <div className="arena-scene-viewport">
      {/* Volumetric Studio Spotlights (Matching Ref 1 & 4) */}
      <div className="arena-spotlight spot-a" />
      <div className="arena-spotlight spot-b" />

      {/* Arena Stage Header Overlay */}
      <div className="arena-stage-header">
        <div className="stage-breadcrumbs">
          <span className="crumb-step">SAUDA ARENA</span>
          <span className="crumb-sep">/</span>
          <span className="crumb-startup">{battle.startup.name.toUpperCase()}</span>
          <span className="crumb-sep">/</span>
          <span className="crumb-live">HEAD-TO-HEAD MATCH</span>
        </div>

        <div className="stage-controls">
          <button className="stage-ghost-btn" onClick={onModifyPitch}>
            EDIT PITCH CRITERIA
          </button>
          <button className="stage-primary-btn" onClick={onProceedToReveal}>
            VIEW FINAL VERDICT &rarr;
          </button>
        </div>
      </div>

      {/* Main 3D Composition Container (Desktop 3-Column Layout from Ref 1 & 2) */}
      <div className="arena-stage-composition">
        {/* LEFT COLUMN: Hologram Tower Contender A */}
        <div className="arena-col col-left">
          <HolographicCompany
            investor={investorA.investor}
            side="left"
            score={investorA.compatibilityScore}
            isWinner={isWinnerA}
          />
        </div>

        {/* CENTER COLUMN: Floating Central Analytical Interface + SVG Animated Data Streams */}
        <div className="arena-col col-center">
          {/* Animated Cyan Energy/Data Streams traveling between towers and analytics (Ref 1 & 3) */}
          <svg className="arena-data-streams-svg" viewBox="0 0 860 220" fill="none">
            {/* Stream Left -> Center */}
            <path
              d="M 10 110 C 190 20, 270 200, 430 110"
              stroke="#00d8f6"
              strokeWidth="2.5"
              strokeDasharray="8 6"
              className="stream-path-left"
            />
            {/* Stream Right -> Center */}
            <path
              d="M 850 110 C 670 20, 590 200, 430 110"
              stroke="#2dd4bf"
              strokeWidth="2.5"
              strokeDasharray="8 6"
              className="stream-path-right"
            />
            {/* Ambient Convergence Glow at center */}
            <circle cx="430" cy="110" r="18" fill="#00d8f6" filter="blur(8px)" opacity="0.6" />
          </svg>

          <CentralAnalytics battle={battle} />
        </div>

        {/* RIGHT COLUMN: Hologram Tower Contender B */}
        <div className="arena-col col-right">
          <HolographicCompany
            investor={investorB.investor}
            side="right"
            score={investorB.compatibilityScore}
            isWinner={isWinnerB}
          />
        </div>
      </div>

      {/* 3D Reflective Geometric Grid Floor (Ref 1, 2, 4) */}
      <div className="arena-reflective-floor">
        <div className="floor-grid-plane" />
        <div className="floor-radial-reflection" />
        <div className="floor-circular-horizon" />
      </div>
    </div>
  );
};
