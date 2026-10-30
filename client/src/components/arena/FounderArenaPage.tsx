import React, { useState, useEffect } from 'react';
import { Swords, Trophy, Gauge, Target, ArrowRight, History, Users, FileText, Sparkles } from 'lucide-react';
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
import './arenaPolish.css';

type ArenaWorkflowView = 'dashboard' | 'select' | 'pitch' | 'battle' | 'reveal' | 'improvement' | 'simulator' | 'history';

const LOCAL_STORAGE_BATTLES_KEY = 'sauda_founder_arena_battles';

export interface FounderArenaPageProps {
  onBackToWorkspace?: () => void;
}

export const FounderArenaPage: React.FC<FounderArenaPageProps> = ({ onBackToWorkspace }) => {
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
          {onBackToWorkspace && (
            <div className="arena-back-row">
              <button
                type="button"
                className="back-to-discovery-btn"
                onClick={onBackToWorkspace}
                aria-label="Back to Founder Workspace"
              >
                <span className="back-arrow" aria-hidden="true">←</span>
                <span>Back to Founder Workspace</span>
              </button>
            </div>
          )}
          {/* Hero */}
          <section className="arena-hero-section">
            <div className="hero-halo" />
            <div className="hero-grid-bg" aria-hidden="true" />

            <div className="hero-copy">
              <span className="hero-kicker">
                <Sparkles size={12} aria-hidden="true" /> SAUDA ARENA • FOUNDER EXCLUSIVE
              </span>
              <h1 className="hero-main-title">
                Your startup. Two contenders.
                <span className="gold-highlight"> One strategic advantage.</span>
              </h1>
              <p className="hero-subtitle">
                Benchmark your venture head-to-head against two real-world venture firms or syndicates, close the
                compatibility gaps, and find out exactly what it takes to become investment-ready.
              </p>

              <div className="hero-cta-group">
                <button className="cta-arena-btn" onClick={() => setCurrentView('select')}>
                  Enter the Arena <ArrowRight size={16} aria-hidden="true" />
                </button>
                {totalBattles > 0 && (
                  <button className="cta-history-btn" onClick={() => setCurrentView('history')}>
                    <History size={15} aria-hidden="true" /> Saved dossiers ({totalBattles})
                  </button>
                )}
              </div>
            </div>

            {/* Live contender preview */}
            <div className="hero-versus-card" aria-label="Current contenders">
              <span className="hvc-eyebrow">CURRENT MATCH-UP</span>
              <div className="hvc-row">
                <div className="hvc-side side-a">
                  <div className="hvc-logo">{investorA?.logoText || investorA?.name?.[0] || '?'}</div>
                  <span className="hvc-name">{investorA?.name ?? 'Select contender'}</span>
                  <span className="hvc-tag">CONTENDER A</span>
                </div>
                <div className="hvc-vs">VS</div>
                <div className="hvc-side side-b">
                  <div className="hvc-logo">{investorB?.logoText || investorB?.name?.[0] || '?'}</div>
                  <span className="hvc-name">{investorB?.name ?? 'Select contender'}</span>
                  <span className="hvc-tag">CONTENDER B</span>
                </div>
              </div>
              <button className="hvc-change" onClick={() => setCurrentView('select')}>
                Change contenders
              </button>
            </div>
          </section>

          {/* Stats */}
          <div className="arena-stats-bar">
            <div className="arena-stat-box">
              <span className="as-icon icon-cyan"><Swords size={16} aria-hidden="true" /></span>
              <span className="as-lbl">TOTAL ARENA BATTLES</span>
              <span className="as-val text-cyan">{totalBattles}</span>
              <span className="as-sub">Calculated evaluations</span>
            </div>

            <div className="arena-stat-box">
              <span className="as-icon icon-green"><Trophy size={16} aria-hidden="true" /></span>
              <span className="as-lbl">PEAK INVESTOR MATCH</span>
              <span className="as-val text-green">{Math.round(bestMatchScore)}%</span>
              <span className="as-sub">Highest compatibility recorded</span>
              <span className="as-meter"><span style={{ width: `${Math.min(100, Math.round(bestMatchScore))}%` }} /></span>
            </div>

            <div className="arena-stat-box">
              <span className="as-icon icon-gold"><Gauge size={16} aria-hidden="true" /></span>
              <span className="as-lbl">AVG. INVESTMENT READINESS</span>
              <span className="as-val text-gold">{avgReadiness}%</span>
              <span className="as-sub">Dossier preparedness index</span>
              <span className="as-meter meter-gold"><span style={{ width: `${Math.min(100, avgReadiness)}%` }} /></span>
            </div>

            <div className="arena-stat-box">
              <span className="as-icon icon-red"><Target size={16} aria-hidden="true" /></span>
              <span className="as-lbl">OUTSTANDING IMPROVEMENTS</span>
              <span className="as-val text-red">{outstandingGaps}</span>
              <span className="as-sub">Action items in recent battle</span>
            </div>
          </div>

          {/* How it works */}
          <section className="arena-how-section" aria-label="How the arena works">
            <div className="how-step">
              <span className="how-ico"><Users size={18} aria-hidden="true" /></span>
              <div>
                <h4>1. Pick two investors</h4>
                <p>Choose verified funds, syndicates or angels from the directory.</p>
              </div>
            </div>
            <div className="how-step">
              <span className="how-ico"><FileText size={18} aria-hidden="true" /></span>
              <div>
                <h4>2. Enter your pitch</h4>
                <p>Add revenue, raise target and use of funds in a short guided form.</p>
              </div>
            </div>
            <div className="how-step">
              <span className="how-ico"><Trophy size={18} aria-hidden="true" /></span>
              <div>
                <h4>3. Get the verdict</h4>
                <p>See the winner, the gaps, and what-if scenarios to close them.</p>
              </div>
            </div>
          </section>

          {/* Recent evaluations */}
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
                <div className="starter-graphic"><Swords size={26} aria-hidden="true" /></div>
                <div className="starter-text">
                  <h4>NO ACTIVE CONTENDER SESSIONS</h4>
                  <p>
                    Select two verified investment firms, enter your company’s revenue and raise targets, and see the
                    full battle breakdown.
                  </p>
                </div>
                <button className="starter-btn" onClick={() => setCurrentView('select')}>
                  START EVALUATION
                </button>
              </div>
            ) : (
              <div className="dashboard-battles-grid">
                {savedBattles.slice(0, 2).map((b) => {
                  const scoreA = Math.round(b.investorA.compatibilityScore);
                  const scoreB = Math.round(b.investorB.compatibilityScore);
                  const aWins = b.winnerInvestorId === b.investorA.investor.id;
                  const bWins = b.winnerInvestorId === b.investorB.investor.id;
                  return (
                    <button
                      type="button"
                      key={b.battleId}
                      className="dash-battle-card"
                      onClick={() => handleSelectHistoricalBattle(b)}
                    >
                      <div className="dbc-top">
                        <span className="dbc-startup">{b.startup.name}</span>
                        <span className="dbc-date">{new Date(b.timestamp).toLocaleDateString()}</span>
                      </div>
                      <div className="dbc-versus">
                        <div className={`dbc-contender ${aWins ? 'is-winner' : ''}`}>
                          <span className="dbc-cname">{b.investorA.investor.name}</span>
                          <span className="dbc-cscore">{scoreA}%</span>
                          <span className="dbc-bar"><span style={{ width: `${scoreA}%` }} /></span>
                        </div>
                        <span className="dbc-vs">VS</span>
                        <div className={`dbc-contender ${bWins ? 'is-winner' : ''}`}>
                          <span className="dbc-cname">{b.investorB.investor.name}</span>
                          <span className="dbc-cscore">{scoreB}%</span>
                          <span className="dbc-bar bar-teal"><span style={{ width: `${scoreB}%` }} /></span>
                        </div>
                      </div>
                      <div className="dbc-footer">
                        <span className="dbc-winner">
                          <Trophy size={12} aria-hidden="true" />
                          {aWins ? b.investorA.investor.name : bWins ? b.investorB.investor.name : 'Tie / Inconclusive'}
                        </span>
                        <span className="dbc-open">Inspect &rarr;</span>
                      </div>
                    </button>
                  );
                })}
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