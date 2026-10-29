import React from 'react';
import type { AuthUser } from '../../services/auth.ts';
import type { Startup } from '../../types/startup.ts';
import type { RegistryMetrics } from '../../utils/registryMetrics.ts';
import { formatCurrencyCompact, formatEquity, formatStageName } from '../../utils/formatters.ts';
import './ViewerDashboard.css';

interface ViewerDashboardProps {
  currentUser: AuthUser;
  startups: Startup[];
  loading: boolean;
  hasError: boolean;
  metrics: RegistryMetrics;
  isCapped: boolean;
  hasFounder: boolean;
  hasInvestor: boolean;
  onSelectStartup: (startup: Startup) => void;
  onNavigateToDiscovery: () => void;
  onOpenWorkspaces: () => void;
  onNavigateToFounder: () => void;
  onNavigateToInvestor: () => void;
  onNavigateToArchive?: (tab?: 'seasons' | 'pitches' | 'sharks' | 'statistics') => void;
  onOpenCompare?: () => void;
}

const countLabel = (value: number, capped: boolean) => `${value.toLocaleString('en-IN')}${capped ? '+' : ''}`;

export const ViewerDashboard: React.FC<ViewerDashboardProps> = ({
  currentUser,
  startups,
  loading,
  hasError,
  metrics,
  isCapped,
  hasFounder,
  hasInvestor,
  onSelectStartup,
  onNavigateToDiscovery,
  onOpenWorkspaces,
  onNavigateToFounder,
  onNavigateToInvestor,
  onNavigateToArchive,
  onOpenCompare,
}) => {
  const firstName = currentUser.fullName.trim().split(/\s+/)[0] || 'there';
  const latestStartups = startups.slice(0, 4);

  const renderMetricValue = (value: number) => {
    if (loading) return '—';
    if (hasError) return 'Unavailable';
    return countLabel(value, isCapped && value === metrics.totalCount);
  };

  const handleOpenArchive = (tab: 'seasons' | 'pitches' | 'sharks' | 'statistics' = 'seasons') => {
    if (onNavigateToArchive) {
      onNavigateToArchive(tab);
    } else {
      onNavigateToDiscovery();
    }
  };

  const handleOpenCompare = () => {
    if (onOpenCompare) {
      onOpenCompare();
    } else {
      onNavigateToDiscovery();
    }
  };

  return (
    <section className="viewer-dashboard" aria-labelledby="viewer-dashboard-title">
      <div className="viewer-dashboard-inner">
        <header className="vd-welcome">
          <div>
            <p className="vd-eyebrow"><span /> VIEWER DASHBOARD</p>
            <h1 id="viewer-dashboard-title">Welcome back, {firstName}.</h1>
            <p className="vd-intro">Your starting point for discovering promising ventures, exploring broadcast archives, and evaluating startups.</p>
          </div>
          <button type="button" className="vd-primary-action" onClick={onNavigateToDiscovery}>
            Explore the registry <span aria-hidden="true">↗</span>
          </button>
        </header>

        {/* Discovery & Research Action Cards */}
        <div className="vd-action-cards-grid" aria-label="Viewer Discovery Hub">
          <div className="vd-action-card">
            <span className="vd-action-icon" aria-hidden="true">⌕</span>
            <div className="vd-action-body">
              <span className="vd-action-tag">VENTURE REGISTRY</span>
              <h3>Startup Explorer</h3>
              <p>Browse and filter published platform opportunities and broadcast pitches.</p>
              <button type="button" className="vd-action-link" onClick={onNavigateToDiscovery}>
                Open Explorer <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div className="vd-action-card">
            <span className="vd-action-icon gold" aria-hidden="true">📺</span>
            <div className="vd-action-body">
              <span className="vd-action-tag gold">BROADCAST VAULT</span>
              <h3>Shark Tank Archive</h3>
              <p>Browse televised seasons, episode rosters, and verified deal outcomes.</p>
              <button type="button" className="vd-action-link gold" onClick={() => handleOpenArchive('seasons')}>
                Open Archive <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div className="vd-action-card">
            <span className="vd-action-icon cyan" aria-hidden="true">🦈</span>
            <div className="vd-action-body">
              <span className="vd-action-tag cyan">INVESTOR DIRECTORY</span>
              <h3>Sharks Roster</h3>
              <p>Explore resident and guest Sharks, chair seating, and deals evaluated.</p>
              <button type="button" className="vd-action-link cyan" onClick={() => handleOpenArchive('sharks')}>
                View Roster <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div className="vd-action-card">
            <span className="vd-action-icon purple" aria-hidden="true">⚖</span>
            <div className="vd-action-body">
              <span className="vd-action-tag purple">ANALYSIS MATRIX</span>
              <h3>Startup Comparison</h3>
              <p>Evaluate 2 or 3 ventures side-by-side with authoritative database comparison.</p>
              <button type="button" className="vd-action-link purple" onClick={handleOpenCompare}>
                Compare Ventures <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>

        <div className="vd-metrics" aria-label="Registry overview">
          <article className="vd-metric-card">
            <span className="vd-metric-icon" aria-hidden="true">◈</span>
            <div><p>Published ventures</p><strong>{renderMetricValue(metrics.totalCount)}</strong><small>{isCapped ? 'Registry result cap reached' : 'Published listings currently available'}</small></div>
          </article>
          <article className="vd-metric-card">
            <span className="vd-metric-icon teal" aria-hidden="true">⌁</span>
            <div><p>Shark Tank pitches</p><strong>{loading || hasError ? '—' : countLabel(metrics.showCount, false)}</strong><small>Televised pitches in the loaded registry</small></div>
          </article>
          <article className="vd-metric-card">
            <span className="vd-metric-icon blue" aria-hidden="true">◇</span>
            <div><p>Platform listings</p><strong>{loading || hasError ? '—' : countLabel(metrics.platformCount, false)}</strong><small>Founder-submitted listings in the loaded registry</small></div>
          </article>
        </div>

        <div className="vd-content-grid">
          <section className="vd-panel vd-latest" aria-labelledby="vd-latest-title">
            <div className="vd-panel-heading">
              <div>
                <p className="vd-panel-kicker">FRESH FROM THE REGISTRY</p>
                <h2 id="vd-latest-title">Recently listed ventures</h2>
              </div>
              <button type="button" className="vd-text-action" onClick={onNavigateToDiscovery}>View registry <span aria-hidden="true">→</span></button>
            </div>

            {loading ? (
              <div className="vd-state" role="status">Loading published ventures…</div>
            ) : hasError ? (
              <div className="vd-state" role="status">
                <strong>Registry temporarily unavailable</strong>
                <span>We could not load venture records right now. Try the registry again shortly.</span>
                <button type="button" className="vd-outline-action" onClick={onNavigateToDiscovery}>Open registry</button>
              </div>
            ) : latestStartups.length === 0 ? (
              <div className="vd-state" role="status">
                <strong>No published ventures yet</strong>
                <span>Published opportunities will appear here when they are available.</span>
                <button type="button" className="vd-outline-action" onClick={onNavigateToDiscovery}>Explore Sauda</button>
              </div>
            ) : (
              <div className="vd-venture-list">
                {latestStartups.map((startup) => {
                  const isShow = startup.pitchType === 'SHOW';
                  const ask = startup.originalAskAmount !== null && Number(startup.originalAskAmount) > 0
                    ? formatCurrencyCompact(startup.originalAskAmount)
                    : 'Ask not stated';
                  const equity = startup.originalAskEquityPct !== null && Number(startup.originalAskEquityPct) > 0
                    ? formatEquity(startup.originalAskEquityPct, 1)
                    : '—';
                  const location = [startup.headquartersCity, startup.headquartersState].filter(Boolean).join(', ');

                  return (
                    <button
                      type="button"
                      className="vd-venture-row"
                      key={`${startup.pitchType}-${startup.pitchId}`}
                      onClick={() => onSelectStartup(startup)}
                      aria-label={`View ${startup.brandName} venture details`}
                    >
                      <span className={`vd-venture-monogram ${isShow ? 'show' : 'platform'}`} aria-hidden="true">
                        {startup.brandName.trim().charAt(0).toUpperCase() || 'V'}
                      </span>
                      <span className="vd-venture-main">
                        <span className="vd-venture-title">{startup.brandName}</span>
                        <span className="vd-venture-subtitle">{startup.industry || formatStageName(startup.startupStage) || 'Published venture'}{location ? ` · ${location}` : ''}</span>
                      </span>
                      <span className="vd-venture-data">
                        <strong>{ask}</strong>
                        <small>{equity} equity</small>
                      </span>
                      <span className={`vd-source-tag ${isShow ? 'show' : 'platform'}`}>{isShow ? 'Shark Tank' : 'Platform'}</span>
                      <span className="vd-row-arrow" aria-hidden="true">↗</span>
                    </button>
                  );
                })}
              </div>
            )}
            {isCapped && !loading && !hasError && (
              <p className="vd-footnote">This preview uses the most recent records returned by the registry. Open the registry to browse and filter listings.</p>
            )}
          </section>

          <aside className="vd-panel vd-workspaces" aria-labelledby="vd-workspaces-title">
            <div className="vd-panel-heading compact">
              <div>
                <p className="vd-panel-kicker">YOUR SAUDA</p>
                <h2 id="vd-workspaces-title">Workspaces</h2>
              </div>
            </div>
            <div className="vd-workspace-option current">
              <span className="vd-workspace-icon viewer" aria-hidden="true">⌕</span>
              <span className="vd-workspace-copy"><strong>Viewer</strong><small>Discover and compare ventures</small></span>
              <span className="vd-current-tag">CURRENT</span>
            </div>
            <div className="vd-workspace-option">
              <span className="vd-workspace-icon founder" aria-hidden="true">↗</span>
              <span className="vd-workspace-copy"><strong>Founder</strong><small>Manage your pitch listings</small></span>
              <button type="button" className="vd-workspace-link" onClick={hasFounder ? onNavigateToFounder : onOpenWorkspaces}>
                {hasFounder ? 'Open' : 'Activate'} <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="vd-workspace-option">
              <span className="vd-workspace-icon investor" aria-hidden="true">⌁</span>
              <span className="vd-workspace-copy"><strong>Investor</strong><small>Review deal opportunities</small></span>
              <button type="button" className="vd-workspace-link" onClick={hasInvestor ? onNavigateToInvestor : onOpenWorkspaces}>
                {hasInvestor ? 'Open' : 'Activate'} <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="vd-workspace-note">
              <span aria-hidden="true">✦</span>
              <p>You can activate Founder or Investor access from Workspaces and return here whenever you need to explore.</p>
            </div>
            <button type="button" className="vd-manage-workspaces" onClick={onOpenWorkspaces}>Manage workspaces <span aria-hidden="true">↗</span></button>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default ViewerDashboard;
