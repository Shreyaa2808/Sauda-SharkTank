import React, { useState, useEffect } from 'react';
import type { InvestorProfile, FounderStartupProfile, InvestmentBlueprint, BattleAnalysisResult } from '../../types/arena';
import { ARENA_INVESTORS } from '../../data/arenaInvestors';
import { runFounderBattleArena } from '../../services/arenaEngine';
import { InvestorSelector } from './InvestorSelector';
import { StartupPitchForm } from './StartupPitchForm';
import { ArenaScene } from './ArenaScene';
import { WinnerReveal } from './WinnerReveal';
import { ImprovementLab } from './ImprovementLab';
import { WhatIfSimulator } from './WhatIfSimulator';
import { BattleHistory } from './BattleHistory';
import './FounderArenaPage.css';

type ArenaWorkflowView = 'dashboard' | 'select' | 'pitch' | 'battle' | 'reveal' | 'improvement' | 'simulator' | 'history';

const LOCAL_STORAGE_BATTLES_KEY = 'sauda_founder_arena_battles';

export const FounderArenaPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<ArenaWorkflowView>('dashboard');

  // Contenders & Pitch state
  const [investorA, setInvestorA] = useState<InvestorProfile | null>(ARENA_INVESTORS[0]);
  const [investorB, setInvestorB] = useState<InvestorProfile | null>(ARENA_INVESTORS[1]);
  const [startupProfile, setStartupProfile] = useState<FounderStartupProfile | null>(null);
  const [blueprint, setBlueprint] = useState<InvestmentBlueprint | null>(null);

  // Active battle result & saved historical battles
  const [activeBattle, setActiveBattle] = useState<BattleAnalysisResult | null>(null);
  const [savedBattles, setSavedBattles] = useState<BattleAnalysisResult[]>([]);

  // Load saved battles from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_BATTLES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedBattles(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load arena battles from localStorage', e);
    }
  }, []);

  const saveBattleRecord = (battle: BattleAnalysisResult) => {
    setSavedBattles((prev) => {
      const filtered = prev.filter((b) => b.battleId !== battle.battleId);
      const updated = [battle, ...filtered];
      try {
        localStorage.setItem(LOCAL_STORAGE_BATTLES_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save arena battle to localStorage', e);
      }
      return updated;
    });
  };

  const handleLaunchEvaluation = (profile: FounderStartupProfile, bp: InvestmentBlueprint) => {
    if (!investorA || !investorB) return;
    setStartupProfile(profile);
    setBlueprint(bp);

    const result = runFounderBattleArena(profile, bp, investorA, investorB);
    setActiveBattle(result);
    saveBattleRecord(result);
    setCurrentView('battle');
  };

  const handleSelectHistoricalBattle = (battle: BattleAnalysisResult) => {
    setActiveBattle(battle);
    setInvestorA(battle.investorA.investor);
    setInvestorB(battle.investorB.investor);
    setStartupProfile(battle.startup);
    setBlueprint(battle.requirements);
    setCurrentView('reveal');
  };

  // Dashboard calculations from actual history
  const totalBattles = savedBattles.length;
  const bestMatchScore = savedBattles.length > 0
    ? Math.max(...savedBattles.map((b) => Math.max(b.investorA.compatibilityScore, b.investorB.compatibilityScore)))
    : 0;
  const avgReadiness = savedBattles.length > 0
    ? Math.round(savedBattles.reduce((acc, b) => acc + b.readiness.overallReadinessScore, 0) / savedBattles.length)
    : 0;
  const outstandingGaps = savedBattles.length > 0
    ? savedBattles[0].improvementPlan.filter((a) => a.status !== 'COMPLETED').length
    : 0;

  return (
    <div className="founder-arena-page-root">
      {/* 1. DASHBOARD VIEW (Entry Stage) */}
      {currentView === 'dashboard' && (
        <div className="arena-dashboard-container">
          {/* Cinematic Hero */}
          <div className="arena-hero-section">
            <div className="hero-halo" />
            <span className="hero-kicker">SAUDA ARENA • FOUNDER EXCLUSIVE</span>
            <h1 className="hero-main-title">
              YOUR STARTUP. TWO CONTENDERS. <br />
              <span className="gold-highlight">ONE STRATEGIC ADVANTAGE.</span>
            </h1>
            <p className="hero-subtitle">
              Enter the cinematic investment arena. Benchmark your venture against two real-world venture firms or
              syndicates, resolve investor compatibility gaps, and discover what it takes to become investment-ready.
            </p>

            <div className="hero-cta-group">
              <button className="cta-arena-btn" onClick={() => setCurrentView('select')}>
                ENTER THE ARENA &rarr;
              </button>
              {totalBattles > 0 && (
                <button className="cta-history-btn" onClick={() => setCurrentView('history')}>
                  VIEW SAVED DOSSIERS ({totalBattles})
                </button>
              )}
            </div>
          </div>

          {/* Actual Saved Metrics Summary Grid */}
          <div className="arena-stats-bar">
            <div className="arena-stat-box">
              <span className="as-lbl">TOTAL ARENA BATTLES</span>
              <span className="as-val text-cyan">{totalBattles}</span>
              <span className="as-sub">Calculated evaluations</span>
            </div>

            <div className="arena-stat-box">
              <span className="as-lbl">PEAK INVESTOR MATCH</span>
              <span className="as-val text-green">{Math.round(bestMatchScore)}%</span>
              <span className="as-sub">Highest compatibility recorded</span>
            </div>

            <div className="arena-stat-box">
              <span className="as-lbl">AVG. INVESTMENT READINESS</span>
              <span className="as-val text-gold">{avgReadiness}%</span>
              <span className="as-sub">Dossier preparedness index</span>
            </div>

            <div className="arena-stat-box">
              <span className="as-lbl">OUTSTANDING IMPROVEMENTS</span>
              <span className="as-val text-red">{outstandingGaps}</span>
              <span className="as-sub">Action items in recent battle</span>
            </div>
          </div>

          {/* Previous Battles Preview or Starter Card */}
          <div className="arena-recent-battles-section">
            <div className="recent-header">
              <h3 className="recent-title">RECENT ARENA EVALUATIONS</h3>
              {totalBattles > 0 && (
                <button className="view-all-link" onClick={() => setCurrentView('history')}>
                  View all ({totalBattles}) &rarr;
                </button>
              )}
            </div>

            {totalBattles === 0 ? (
              <div className="arena-starter-card">
                <div className="starter-graphic">⚔</div>
                <div className="starter-text">
                  <h4>NO ACTIVE CONTENDER SESSIONS</h4>
                  <p>
                    Select two verified investment firms, enter your company’s revenue and raise targets, and witness the
                    full cinematic mathematical battle breakdown.
                  </p>
                </div>
                <button className="starter-btn" onClick={() => setCurrentView('select')}>
                  START EVALUATION
                </button>
              </div>
            ) : (
              <div className="dashboard-battles-grid">
                {savedBattles.slice(0, 2).map((b) => (
                  <div key={b.battleId} className="dash-battle-card" onClick={() => handleSelectHistoricalBattle(b)}>
                    <div className="dbc-top">
                      <span className="dbc-startup">{b.startup.name}</span>
                      <span className="dbc-date">{new Date(b.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div className="dbc-h2h">
                      <span>{b.investorA.investor.name} ({Math.round(b.investorA.compatibilityScore)}%)</span>
                      <span className="dbc-vs">VS</span>
                      <span>{b.investorB.investor.name} ({Math.round(b.investorB.compatibilityScore)}%)</span>
                    </div>
                    <div className="dbc-footer">
                      <span className="dbc-winner">
                        Winner: {b.winnerInvestorId === b.investorA.investor.id ? b.investorA.investor.name : b.winnerInvestorId === b.investorB.investor.id ? b.investorB.investor.name : 'Tie / Inconclusive'}
                      </span>
                      <span className="dbc-open">Inspect &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. SELECT CONTENDERS VIEW */}
      {currentView === 'select' && (
        <InvestorSelector
          selectedInvestorA={investorA}
          selectedInvestorB={investorB}
          onSelectA={setInvestorA}
          onSelectB={setInvestorB}
          onProceed={() => setCurrentView('pitch')}
          onBack={() => setCurrentView('dashboard')}
        />
      )}

      {/* 3. STARTUP PITCH & REQUIREMENTS FORM */}
      {currentView === 'pitch' && (
        <StartupPitchForm
          initialProfile={startupProfile || undefined}
          initialBlueprint={blueprint || undefined}
          onSubmit={handleLaunchEvaluation}
          onBack={() => setCurrentView('select')}
        />
      )}

      {/* 4. CINEMATIC 3D BATTLE ARENA */}
      {currentView === 'battle' && activeBattle && (
        <ArenaScene
          battle={activeBattle}
          onProceedToReveal={() => setCurrentView('reveal')}
          onModifyPitch={() => setCurrentView('pitch')}
        />
      )}

      {/* 5. WINNER REVEAL & ANALYTICS VERDICT */}
      {currentView === 'reveal' && activeBattle && (
        <WinnerReveal
          battle={activeBattle}
          onOpenImprovementLab={() => setCurrentView('improvement')}
          onOpenSimulator={() => setCurrentView('simulator')}
          onBackToArena={() => setCurrentView('battle')}
        />
      )}

      {/* 6. FOUNDER IMPROVEMENT LAB */}
      {currentView === 'improvement' && activeBattle && (
        <ImprovementLab
          initialActions={activeBattle.improvementPlan}
          onBackToReveal={() => setCurrentView('reveal')}
          onOpenSimulator={() => setCurrentView('simulator')}
        />
      )}

      {/* 7. WHAT-IF SENSITIVITY SIMULATOR */}
      {currentView === 'simulator' && activeBattle && (
        <WhatIfSimulator
          battle={activeBattle}
          onBackToResults={() => setCurrentView('reveal')}
          onApplyChanges={(updatedBattle) => {
            setActiveBattle(updatedBattle);
            saveBattleRecord(updatedBattle);
            setCurrentView('reveal');
          }}
        />
      )}

      {/* 8. BATTLE HISTORY & DOSSIERS */}
      {currentView === 'history' && (
        <BattleHistory
          battles={savedBattles}
          onSelectBattle={handleSelectHistoricalBattle}
          onNewBattle={() => setCurrentView('select')}
        />
      )}
    </div>
  );
};
