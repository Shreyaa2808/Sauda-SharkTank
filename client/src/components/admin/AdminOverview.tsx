import React, { useEffect, useState } from 'react';
import {
  fetchReviewQueue,
  fetchHistoricalStatistics,
  fetchDatabaseHealth,
  fetchImportReports,
  type HistoricalStatistics,
  type ImportReportSummary,
} from '../../services/admin.ts';
import './AdminOverview.css';

interface AdminOverviewProps {
  onNavigate: (section: 'reviews' | 'historical' | 'imports') => void;
}

interface BarRow { key: string | number; label: string; value: number; sub?: string }

const HBars: React.FC<{ loading: boolean; rows: BarRow[]; empty: string }> = ({ loading, rows, empty }) => {
  if (loading) return <div className="panel-state-text">Loading chart…</div>;
  if (rows.length === 0) return <div className="panel-state-text">{empty}</div>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="hbar-head">
            <span className="hbar-label">{r.label}</span>
            <span className="hbar-value">{r.value}{r.sub ? <em> · {r.sub}</em> : null}</span>
          </div>
          <div className="hbar-track"><span style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
};

export const AdminOverview: React.FC<AdminOverviewProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingReviewsCount, setPendingReviewsCount] = useState<number | null>(null);
  const [dbHealth, setDbHealth] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [stats, setStats] = useState<HistoricalStatistics | null>(null);
  const [recentImports, setRecentImports] = useState<ImportReportSummary[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOverview() {
      setLoading(true);
      setError(null);

      // Settle all promises independently so one failure does not blank the overview
      const [reviewRes, healthRes, statsRes, importsRes] = await Promise.allSettled([
        fetchReviewQueue(controller.signal),
        fetchDatabaseHealth(controller.signal),
        fetchHistoricalStatistics(controller.signal),
        fetchImportReports(5, 0, controller.signal),
      ]);

      if (controller.signal.aborted) return;

      if (reviewRes.status === 'fulfilled') {
        setPendingReviewsCount(reviewRes.value.length);
      } else {
        setPendingReviewsCount(null);
      }

      if (healthRes.status === 'fulfilled') {
        setDbHealth(healthRes.value.database);
      } else {
        setDbHealth('disconnected');
      }

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      } else {
        setStats(null);
      }

      if (importsRes.status === 'fulfilled') {
        setRecentImports(importsRes.value);
      } else {
        setRecentImports([]);
      }

      if (
        reviewRes.status === 'rejected' &&
        healthRes.status === 'rejected' &&
        statsRes.status === 'rejected'
      ) {
        setError('Unable to load operational telemetry from server. Check that backend is running.');
      }

      setLoading(false);
    }

    void loadOverview();
    return () => controller.abort();
  }, []);

  // Compute aggregate numbers from real statistics
  const totalSeasons = stats?.dealsBySeason.length ?? 0;
  const totalSharks = stats?.sharkActivity.length ?? 0;
  const totalHistoricalPitches = stats?.dealsBySeason.reduce((acc, s) => acc + (Number(s.pitchCount) || 0), 0) ?? 0;
  const totalCompletedDeals = stats?.dealsBySeason.reduce((acc, s) => acc + (Number(s.completedDeals) || 0), 0) ?? 0;

  const seasonBars = (stats?.dealsBySeason ?? []).map((d) => {
    const completed = Number(d.completedDeals) || 0;
    const fell = Number(d.fellThroughDeals) || 0;
    const pending = Number(d.pendingDeals) || 0;
    const none = Number(d.noRecordedOutcome) || 0;
    return {
      seasonId: d.seasonId,
      seasonNumber: d.seasonNumber,
      pitchCount: Number(d.pitchCount) || completed + fell + pending + none,
      segments: [
        { key: 'completed', label: 'Deal done', value: completed },
        { key: 'fell', label: 'Fell through', value: fell },
        { key: 'pending', label: 'Pending', value: pending },
        { key: 'none', label: 'No outcome', value: none },
      ],
    };
  });
  const maxSeasonPitches = Math.max(...seasonBars.map((b) => b.pitchCount), 1);
  const topSectors: BarRow[] = [...(stats?.sectorDistribution ?? [])]
    .sort((a, b) => Number(b.pitchCount) - Number(a.pitchCount))
    .slice(0, 6)
    .map((x) => ({ key: x.industryId, label: x.industryName, value: Number(x.pitchCount) || 0, sub: `${Number(x.completedDeals) || 0} deals` }));
  const topSharks: BarRow[] = [...(stats?.sharkActivity ?? [])]
    .sort((a, b) => Number(b.pitchesSeen) - Number(a.pitchesSeen))
    .slice(0, 6)
    .map((x) => ({ key: x.sharkId, label: x.displayName, value: Number(x.pitchesSeen) || 0, sub: `${Number(x.completedDealsAssociated) || 0} deals` }));
  const importTotals = (() => {
    const ok = recentImports.reduce((a, i) => a + (Number(i.importedRows) || 0), 0);
    const failed = recentImports.reduce((a, i) => a + (Number(i.failedRows) || 0), 0);
    const total = ok + failed;
    return { ok, failed, total, okPct: total ? Math.round((ok / total) * 100) : 0 };
  })();

  return (
    <div className="admin-overview-container">
      {error && (
        <div className="overview-error-banner" role="alert">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
      {/* Primary Action Card: Pitch Reviews Queue */}
      <section className="overview-hero-card" aria-labelledby="overview-queue-title">
        <div className="hero-card-content">
          <div className="hero-card-topline">
            <span className="hero-status-pill amber">
              <span className="pill-dot" />
              <span>MODERATION BACKLOG</span>
            </span>
            <span className="hero-badge">ACTION REQUIRED</span>
          </div>

          <h2 id="overview-queue-title">
            {loading ? (
              'Checking Review Backlog…'
            ) : pendingReviewsCount !== null && pendingReviewsCount > 0 ? (
              `${pendingReviewsCount} ${pendingReviewsCount === 1 ? 'Pitch' : 'Pitches'} Awaiting Decision`
            ) : pendingReviewsCount === 0 ? (
              'Review Queue Is Clear'
            ) : (
              'Review Backlog Unavailable'
            )}
          </h2>

          <p className="hero-card-desc">
            Founder submissions for the platform exchange must be approved or rejected with feedback
            before they are published to institutional investors and the venture registry.
          </p>

          <div className="hero-card-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => onNavigate('reviews')}
            >
              <span>Open Review Queue</span>
              <span aria-hidden="true">→</span>
            </button>

            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={() => onNavigate('imports')}
            >
              <span>Batch Import CSV</span>
            </button>
          </div>
        </div>

        <div className="hero-metric-callout">
          <span className="metric-callout-number">
            {loading ? '—' : pendingReviewsCount ?? '—'}
          </span>
          <span className="metric-callout-label">PENDING SUBMISSIONS</span>
        </div>
      </section>

      {/* Operational Telemetry Grid */}
      <section className="overview-kpi-grid" aria-label="System Metrics">
        {/* DB Health Card */}
        <article className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">DATABASE CONNECTION</span>
            <span className={`kpi-indicator ${dbHealth === 'connected' ? 'online' : 'offline'}`} />
          </div>
          <div className="kpi-value-row">
            <strong className="kpi-value">
              {loading ? '…' : dbHealth === 'connected' ? 'Operational' : 'Disconnected'}
            </strong>
          </div>
          <span className="kpi-sub">MySQL 8.0 Primary Node</span>
        </article>

        {/* Historical Seasons */}
        <article className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">TELEVISED SEASONS</span>
            <span className="kpi-tag">REGISTRY</span>
          </div>
          <div className="kpi-value-row">
            <strong className="kpi-value">{loading ? '…' : totalSeasons}</strong>
          </div>
          <span className="kpi-sub">Shark Tank Show Franchise</span>
        </article>

        {/* Historical Sharks */}
        <article className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">ROSTER SHARKS</span>
            <span className="kpi-tag gold">INVESTORS</span>
          </div>
          <div className="kpi-value-row">
            <strong className="kpi-value">{loading ? '…' : totalSharks}</strong>
          </div>
          <span className="kpi-sub">Televised Institutional Investors</span>
        </article>

        {/* Historical Pitches */}
        <article className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">SHOW PITCHES RECORDED</span>
            <span className="kpi-tag emerald">VERIFIED</span>
          </div>
          <div className="kpi-value-row">
            <strong className="kpi-value">{loading ? '…' : totalHistoricalPitches}</strong>
          </div>
          <span className="kpi-sub">{totalCompletedDeals} completed deals recorded</span>
        </article>
      </section>


      {/* Visual analytics */}
      <section className="overview-charts" aria-label="Historical analytics">
        <article className="chart-card chart-card-wide">
          <div className="panel-header">
            <h3>Pitch outcomes by season</h3>
            <span className="panel-kicker">DEALS</span>
          </div>
          {loading ? (
            <div className="panel-state-text">Loading chart…</div>
          ) : seasonBars.length === 0 ? (
            <div className="panel-state-text">No season data recorded yet.</div>
          ) : (
            <>
              <div className="stack-chart" role="img" aria-label="Stacked bars of pitch outcomes per season">
                {seasonBars.map((b) => (
                  <div className="stack-col" key={b.seasonId} title={`Season ${b.seasonNumber}: ${b.pitchCount} pitches`}>
                    <span className="stack-total">{b.pitchCount}</span>
                    <div className="stack-bar" style={{ height: `${(b.pitchCount / maxSeasonPitches) * 100}%` }}>
                      {b.segments.map((seg) => (
                        seg.value > 0 ? (
                          <span key={seg.key} className={`seg seg-${seg.key}`} style={{ flexGrow: seg.value }} title={`${seg.label}: ${seg.value}`} />
                        ) : null
                      ))}
                    </div>
                    <span className="stack-label">S{b.seasonNumber}</span>
                  </div>
                ))}
              </div>
              <ul className="chart-legend">
                <li><i className="seg-completed" />Deal done</li>
                <li><i className="seg-fell" />Fell through</li>
                <li><i className="seg-pending" />Pending</li>
                <li><i className="seg-none" />No outcome</li>
              </ul>
            </>
          )}
        </article>

        <article className="chart-card">
          <div className="panel-header">
            <h3>Import health</h3>
            <span className="panel-kicker">CSV</span>
          </div>
          {loading ? (
            <div className="panel-state-text">Loading chart…</div>
          ) : importTotals.total === 0 ? (
            <div className="panel-state-text">No imports yet.</div>
          ) : (
            <div className="donut-wrap">
              <svg viewBox="0 0 120 120" className="donut" role="img" aria-label={`${importTotals.okPct}% of imported rows succeeded`}>
                <circle cx="60" cy="60" r="48" className="donut-track" />
                <circle cx="60" cy="60" r="48" className="donut-fill" strokeDasharray={`${(importTotals.okPct / 100) * 301.6} 301.6`} transform="rotate(-90 60 60)" />
                <text x="60" y="58" textAnchor="middle" className="donut-num">{importTotals.okPct}%</text>
                <text x="60" y="76" textAnchor="middle" className="donut-sub">success</text>
              </svg>
              <ul className="chart-legend column">
                <li><i className="seg-completed" />{importTotals.ok} imported</li>
                <li><i className="seg-fell" />{importTotals.failed} failed</li>
              </ul>
            </div>
          )}
        </article>

        <article className="chart-card">
          <div className="panel-header">
            <h3>Top sectors</h3>
            <span className="panel-kicker">PITCHES</span>
          </div>
          <HBars loading={loading} rows={topSectors} empty="No sector data yet." />
        </article>

        <article className="chart-card chart-card-wide">
          <div className="panel-header">
            <h3>Most active sharks</h3>
            <span className="panel-kicker">PITCHES SEEN</span>
          </div>
          <HBars loading={loading} rows={topSharks} empty="No shark activity recorded yet." />
        </article>
      </section>

      {/* Two Column Lower Stage: Quick Tools & Recent Imports */}
      <div className="overview-split-stage">
        {/* Quick Operational Shortcuts */}
        <section className="overview-panel" aria-labelledby="shortcuts-title">
          <div className="panel-header">
            <h3 id="shortcuts-title">Administrative Workflows</h3>
            <span className="panel-kicker">ACTIONS</span>
          </div>

          <div className="workflow-links-list">
            <button
              type="button"
              className="workflow-link-row"
              onClick={() => onNavigate('reviews')}
            >
              <div className="wf-icon gold">⚖</div>
              <div className="wf-text">
                <strong>Pitch Moderation Queue</strong>
                <span>Inspect company profiles, valuations, and record review decisions</span>
              </div>
              <span className="wf-arrow">→</span>
            </button>

            <button
              type="button"
              className="workflow-link-row"
              onClick={() => onNavigate('historical')}
            >
              <div className="wf-icon blue">📺</div>
              <div className="wf-text">
                <strong>Historical Data Management</strong>
                <span>Add, update, or remove televised seasons, episodes, and sharks</span>
              </div>
              <span className="wf-arrow">→</span>
            </button>

            <button
              type="button"
              className="workflow-link-row"
              onClick={() => onNavigate('imports')}
            >
              <div className="wf-icon emerald">📥</div>
              <div className="wf-text">
                <strong>CSV Batch Ingestion</strong>
                <span>Upload formatted historical venture CSVs with schema validation</span>
              </div>
              <span className="wf-arrow">→</span>
            </button>
          </div>
        </section>

        {/* Recent CSV Import Activity */}
        <section className="overview-panel" aria-labelledby="imports-title">
          <div className="panel-header">
            <h3 id="imports-title">Recent Ingestion Activity</h3>
            <button
              type="button"
              className="panel-link-btn"
              onClick={() => onNavigate('imports')}
            >
              View all audits →
            </button>
          </div>

          {loading ? (
            <div className="panel-state-text">Loading recent import audit reports…</div>
          ) : recentImports.length === 0 ? (
            <div className="panel-state-empty">
              <span>📁</span>
              <p>No CSV batch imports recorded yet.</p>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => onNavigate('imports')}
              >
                Upload First CSV
              </button>
            </div>
          ) : (
            <div className="recent-imports-list">
              {recentImports.map((imp) => (
                <div key={imp.importId} className="recent-import-item">
                  <div className="import-item-main">
                    <span className="import-id">#IMP-{imp.importId}</span>
                    <span className="import-date">
                      {new Date(imp.importedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="import-item-stats">
                    <span className="import-stat-pill emerald">
                      ✓ {imp.importedRows} imported
                    </span>
                    {imp.failedRows > 0 && (
                      <span className="import-stat-pill crimson">
                        ⚠ {imp.failedRows} failed
                      </span>
                    )}
                    <span className="import-total-stat">of {imp.totalRows}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminOverview;
