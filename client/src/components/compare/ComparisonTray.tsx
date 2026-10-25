import React from 'react';
import type { Startup } from '../../types/startup.ts';

interface ComparisonTrayProps {
  selectedStartups: Startup[];
  onRemove: (pitchId: number) => void;
  onClear: () => void;
  onOpenMatrix: () => void;
}

export const ComparisonTray: React.FC<ComparisonTrayProps> = ({
  selectedStartups,
  onRemove,
  onClear,
  onOpenMatrix,
}) => {
  if (selectedStartups.length === 0) {
    return null;
  }

  const count = selectedStartups.length;
  const canCompare = count >= 2 && count <= 3;
  const pitchType = selectedStartups[0]?.pitchType;

  return (
    <aside
      className="comparison-tray-bar"
      role="region"
      aria-label="Startup comparison tray"
    >
      <div className="tray-inner-container">
        {/* Tray Left: Status & Source Type */}
        <div className="tray-header">
          <div className="tray-count-indicator">
            <span className="tray-count-num">{count}/3</span>
            <span className="tray-count-label">SELECTED</span>
          </div>

          <div className="tray-type-badge">
            <span
              className={`pitch-badge ${
                pitchType === 'PLATFORM' ? 'platform' : 'show'
              }`}
            >
              <span className="badge-dot" />
              {pitchType === 'PLATFORM'
                ? 'PLATFORM LISTINGS ONLY'
                : 'SHOW PITCHES ONLY'}
            </span>
          </div>
        </div>

        {/* Tray Center: Selected Startup Chips */}
        <div className="tray-chips-list" role="list">
          {selectedStartups.map((startup) => (
            <div
              className="tray-chip"
              key={startup.pitchId}
              role="listitem"
            >
              <span className="chip-monogram" aria-hidden="true">
                {startup.brandName.trim().charAt(0).toUpperCase()}
              </span>
              <span className="chip-name">{startup.brandName}</span>
              <button
                type="button"
                className="chip-remove-btn"
                onClick={() => onRemove(startup.pitchId)}
                aria-label={`Remove ${startup.brandName} from comparison`}
                title={`Remove ${startup.brandName}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Tray Right: Actions */}
        <div className="tray-actions">
          <button
            type="button"
            className="tray-clear-btn"
            onClick={onClear}
            aria-label="Clear all selected startups"
          >
            Clear all
          </button>

          <button
            type="button"
            className={`tray-compare-btn ${canCompare ? 'ready' : 'disabled'}`}
            disabled={!canCompare}
            onClick={onOpenMatrix}
            aria-label={
              canCompare
                ? `Compare ${count} startups side by side`
                : 'Select at least 2 startups of the same type to compare'
            }
          >
            <span>Compare ({count})</span>
            {canCompare && (
              <span className="tray-btn-arrow" aria-hidden="true">
                →
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
