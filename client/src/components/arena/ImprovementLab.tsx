import React, { useState } from 'react';
import type { ImprovementAction } from '../../types/arena';
import './ImprovementLab.css';

interface ImprovementLabProps {
  initialActions: ImprovementAction[];
  onBackToReveal: () => void;
  onOpenSimulator: () => void;
}

export const ImprovementLab: React.FC<ImprovementLabProps> = ({
  initialActions,
  onBackToReveal,
  onOpenSimulator,
}) => {
  const [actions, setActions] = useState<ImprovementAction[]>(initialActions);
  const [filterPriority, setFilterPriority] = useState<string>('ALL');

  const toggleStatus = (id: string) => {
    setActions((prev) =>
      prev.map((act) => {
        if (act.id !== id) return act;
        const nextStatus =
          act.status === 'NOT_STARTED' ? 'IN_PROGRESS' : act.status === 'IN_PROGRESS' ? 'COMPLETED' : 'NOT_STARTED';
        return { ...act, status: nextStatus };
      })
    );
  };

  const filteredActions = actions.filter((act) => {
    if (filterPriority === 'ALL') return true;
    return act.priority === filterPriority;
  });

  const completedCount = actions.filter((a) => a.status === 'COMPLETED').length;
  const inProgressCount = actions.filter((a) => a.status === 'IN_PROGRESS').length;
  const potentialLift = Math.round(
    actions
      .filter((a) => a.status !== 'COMPLETED')
      .reduce((sum, a) => sum + a.potentialScoreLiftPct, 0)
  );

  return (
    <div className="improvement-lab-view">
      {/* Top Header */}
      <div className="lab-header">
        <button className="lab-back-btn" onClick={onBackToReveal}>
          &larr; BACK TO RESULTS
        </button>

        <div className="lab-title-group">
          <span className="lab-eyebrow">FOUNDER ACTION STUDIO</span>
          <h2 className="lab-title">WHAT'S KEEPING YOU FROM A STRONGER MATCH?</h2>
          <p className="lab-sub">
            Targeted institutional recommendations to eliminate investor friction and raise compatibility scores.
          </p>
        </div>

        <button className="lab-sim-btn" onClick={onOpenSimulator}>
          TEST IN WHAT-IF SIMULATOR &rarr;
        </button>
      </div>

      {/* Progress & Lift Summary Cards */}
      <div className="lab-summary-row">
        <div className="lab-metric-card">
          <span className="m-lbl">POTENTIAL COMPATIBILITY LIFT</span>
          <span className="m-val text-green">+{potentialLift}%</span>
          <span className="m-desc">By resolving uncompleted actions</span>
        </div>

        <div className="lab-metric-card">
          <span className="m-lbl">RESOLVED GAPS</span>
          <span className="m-val text-cyan">{completedCount} / {actions.length}</span>
          <span className="m-desc">{inProgressCount} currently in progress</span>
        </div>

        <div className="lab-metric-card">
          <span className="m-lbl">FILTER BY PRIORITY</span>
          <div className="filter-buttons">
            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((pri) => (
              <button
                key={pri}
                className={`pri-btn ${filterPriority === pri ? 'active' : ''}`}
                onClick={() => setFilterPriority(pri)}
              >
                {pri}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Improvement Actions List */}
      <div className="actions-list">
        {filteredActions.map((action) => (
          <div key={action.id} className={`action-card status-${action.status.toLowerCase()}`}>
            <div className="action-top">
              <div className="action-badges">
                <span className={`p-badge p-${action.priority.toLowerCase()}`}>{action.priority} PRIORITY</span>
                <span className="cat-badge">{action.category}</span>
                <span className="lift-badge">+{action.potentialScoreLiftPct}% LIFT</span>
              </div>

              {/* Status Toggle Button */}
              <button className={`status-toggle-btn btn-${action.status.toLowerCase()}`} onClick={() => toggleStatus(action.id)}>
                {action.status === 'COMPLETED' ? '✓ COMPLETED' : action.status === 'IN_PROGRESS' ? 'IN PROGRESS' : 'MARK STARTED'}
              </button>
            </div>

            <h4 className="action-title">{action.gapTitle}</h4>
            <p className="action-desc">{action.recommendedAction}</p>

            <div className="action-footer">
              <div className="timeframe-box">
                <span className="tf-lbl">CURRENT:</span>
                <span className="tf-val">{action.currentSituation}</span>
              </div>
              <span className="click-hint">Click status pill to update progress</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
