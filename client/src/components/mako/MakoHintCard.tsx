import React, { useEffect, useState } from 'react';
import { MakoAvatar } from './MakoAvatar.tsx';
import type { MakoState, PitchType } from '../../types/startup.ts';

export interface MakoCustomNotice {
  title: string;
  message: string;
  badgeText: string;
  state?: MakoState;
}

interface MakoHintCardProps {
  state: MakoState;
  activeFilter: 'ALL' | PitchType;
  searchQuery: string;
  totalResults: number;
  customNotice?: MakoCustomNotice | null;
  onClearCustomNotice?: () => void;
  onClearFilters?: () => void;
  onRetryConnection?: () => void;
  className?: string;
}

export const MakoHintCard: React.FC<MakoHintCardProps> = ({
  state,
  activeFilter,
  searchQuery,
  totalResults,
  customNotice,
  onClearCustomNotice,
  onClearFilters,
  onRetryConnection,
  className = '',
}) => {
  // Track which context state was dismissed by the user
  const [dismissedContextKey, setDismissedContextKey] = useState<string | null>(null);

  const effectiveState = customNotice?.state || state;
  const currentContextKey = customNotice
    ? `notice-${customNotice.title}-${customNotice.message}`
    : `${effectiveState}-${activeFilter}-${searchQuery}`;

  const isDismissed = dismissedContextKey === currentContextKey;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDismissedContextKey(currentContextKey);
        onClearCustomNotice?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentContextKey, onClearCustomNotice]);

  // Contextual copy derivation
  let title = 'Mako Scout';
  let message = 'Exploring published startup records. Filter by Show or Platform to refine your search.';
  let badgeText = 'OCEAN GUIDE';

  if (customNotice) {
    title = customNotice.title;
    message = customNotice.message;
    badgeText = customNotice.badgeText;
  } else if (state === 'offline') {
    title = 'Signal Lost in the Deep';
    message = 'Cannot reach the database at localhost:4000. Ensure your Express server and MySQL container are running.';
    badgeText = 'OFFLINE';
  } else if (state === 'empty') {
    title = 'No Pitches in this Sector';
    message = searchQuery
      ? `No startups matched "${searchQuery}". Try broadening your keywords or clearing the source filter.`
      : 'No startups found for the selected filter. Try switching back to "All pitches".';
    badgeText = 'SEARCH TIP';
  } else if (activeFilter === 'SHOW') {
    title = 'Shark Tank India Archive';
    message = 'You are viewing historical pitches that aired on the televised show, along with original ask amounts.';
    badgeText = 'SHOW ARCHIVE';
  } else if (activeFilter === 'PLATFORM') {
    title = 'Platform Listings';
    message = 'Viewing registered platform startups seeking independent angel and syndicate connections.';
    badgeText = 'PLATFORM LISTINGS';
  } else if (searchQuery.trim()) {
    title = 'Radar Active';
    message = `Filtering ${totalResults} pitch${totalResults === 1 ? '' : 'es'} matching "${searchQuery}".`;
    badgeText = 'RADAR';
  }

  const handleDismiss = () => {
    setDismissedContextKey(currentContextKey);
    onClearCustomNotice?.();
  };

  if (isDismissed) {
    return (
      <aside className="mako-dock-trigger" aria-label="Mako Navigator">
        <button
          type="button"
          className="mako-summon-button"
          onClick={() => {
            setDismissedContextKey(null);
          }}
          title="Open Mako's Guidance"
          aria-label="Open Mako's Guidance"
        >
          <MakoAvatar state={effectiveState} size="xs" animated={false} />
          <span className="summon-label">Mako Guide</span>
          {effectiveState === 'offline' && <span className="summon-dot error" />}
          {effectiveState === 'empty' && <span className="summon-dot warning" />}
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={`mako-hint-card mako-theme-${effectiveState} ${className}`}
      role="status"
      aria-live="polite"
      aria-label="Mako Guide tip"
    >
      <div className="hint-card-avatar">
        <MakoAvatar state={effectiveState} size="sm" animated={true} />
      </div>

      <div className="hint-card-content">
        <div className="hint-card-header">
          <span className="hint-badge">{badgeText}</span>
          <h4 className="hint-title">{title}</h4>
        </div>
        <p className="hint-message">{message}</p>

        <div className="hint-actions">
          {state === 'empty' && onClearFilters && !customNotice && (
            <button
              type="button"
              className="hint-btn hint-btn-primary"
              onClick={onClearFilters}
            >
              Reset search filters
            </button>
          )}

          {state === 'offline' && onRetryConnection && !customNotice && (
            <button
              type="button"
              className="hint-btn hint-btn-primary"
              onClick={onRetryConnection}
            >
              Retry API connection
            </button>
          )}

          <button
            type="button"
            className="hint-btn hint-btn-ghost"
            onClick={handleDismiss}
            aria-label="Dismiss guide tip"
          >
            Dismiss
          </button>
        </div>
      </div>

      <button
        type="button"
        className="hint-close-button"
        onClick={handleDismiss}
        aria-label="Close Mako advice"
        title="Dismiss (Esc)"
      >
        ×
      </button>
    </aside>
  );
};
