import React from 'react';
import type { Startup } from '../../types/startup.ts';
import type { RegistryMetrics } from '../../utils/registryMetrics.ts';
import { formatCurrencyCompact, formatEquity } from '../../utils/formatters.ts';
import './DiscoveryHero.css';

interface DiscoveryHeroProps {
  loading: boolean;
  /** True when the startup request failed (KPIs show an unavailable state, never zeros). */
  hasError: boolean;
  metrics: RegistryMetrics;
  /** True when the API page size was reached, so totals are a lower bound. */
  isCapped: boolean;
  /** Most recent published records (API order), used for the live preview panel. */
  startups: Startup[];
  onSelectStartup: (startup: Startup) => void;
  onExplore: () => void;
  onBrowseShow: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Live preview of the most recent published records: real data, each row opens the startup's details. */
const RegistryPreview: React.FC<{
  startups: Startup[];
  loading: boolean;
  hasError: boolean;
  onSelect: (startup: Startup) => void;
  onViewAll: () => void;
  total: number;
}> = ({ startups, loading, hasError, onSelect, onViewAll, total }) => {
  const rows = startups.slice(0, 3);

  return (
    <aside className="registry-preview" aria-label="Latest published ventures">
      <header className="registry-preview-head">
        <span className="registry-preview-title">Latest in the registry</span>
        <span className="registry-preview-live" aria-hidden="true" />
      </header>

      {loading ? (
        <ul className="registry-preview-list" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="registry-preview-row is-skeleton">
              <span className="rp-skel rp-skel-title" />
              <span className="rp-skel rp-skel-sub" />
            </li>
          ))}
        </ul>
      ) : hasError ? (
        <p className="registry-preview-empty">The registry is unavailable right now.</p>
      ) : rows.length === 0 ? (
        <p className="registry-preview-empty">No ventures have been published yet.</p>
      ) : (
        <ul className="registry-preview-list">
          {rows.map((s) => {
            const isPlatform = s.pitchType === 'PLATFORM';
            const ask = s.originalAskAmount !== null && Number(s.originalAskAmount) > 0;
            const eq = s.originalAskEquityPct !== null && Number(s.originalAskEquityPct) > 0;
            return (
              <li key={s.pitchId}>
                <button
                  type="button"
                  className="registry-preview-row"
                  onClick={() => onSelect(s)}
                  aria-label={`View details for ${s.brandName}`}
                >
                  <span className="rp-main">
                    <span className="rp-name">{s.brandName}</span>
                    <span className="rp-meta">
                      <span className={`rp-source ${isPlatform ? 'platform' : 'show'}`}>
                        {isPlatform ? 'Platform' : 'Shark Tank'}
                      </span>
                      {s.industry && <span className="rp-industry">{s.industry}</span>}
                    </span>
                  </span>
                  <span className="rp-figures">
                    <span className="rp-ask">{ask ? formatCurrencyCompact(s.originalAskAmount) : 'Ask not stated'}</span>
                    {eq && <span className="rp-equity">{formatEquity(s.originalAskEquityPct, 1)} equity</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !hasError && total > rows.length && (
        <button type="button" className="registry-preview-all" onClick={onViewAll}>
          View all {total}
          <span aria-hidden="true"> →</span>
        </button>
      )}
    </aside>
  );
};

export const DiscoveryHero: React.FC<DiscoveryHeroProps> = ({
  loading,
  hasError,
  metrics,
  isCapped,
  startups,
  onSelectStartup,
  onExplore,
  onBrowseShow,
}) => {
  const pending = loading;
  const unavailable = !loading && hasError;
  const empty = !loading && !hasError && metrics.totalCount === 0;
  const dash = '—';

  const total = pending || unavailable ? dash : `${isCapped ? `${metrics.totalCount}+` : pad2(metrics.totalCount)}`;
  const showPct = metrics.totalCount > 0 ? (metrics.showCount / metrics.totalCount) * 100 : 0;

  const askValue =
    pending || unavailable ? dash : metrics.totalAsk === null ? dash : formatCurrencyCompact(metrics.totalAsk);
  const askSub = unavailable
    ? 'Registry unavailable'
    : pending
      ? 'Loading…'
      : metrics.totalAsk === null
        ? 'No asks recorded'
        : `Stated by ${metrics.askSampleCount} of ${metrics.totalCount} pitches`;

  const equityValue =
    pending || unavailable ? dash : metrics.avgEquity === null ? dash : formatEquity(metrics.avgEquity, 1);
  const equitySub = unavailable
    ? 'Registry unavailable'
    : pending
      ? 'Loading…'
      : metrics.avgEquity === null
        ? 'No equity recorded'
        : `Mean of ${metrics.equitySampleCount} stated ${metrics.equitySampleCount === 1 ? 'value' : 'values'}`;

  return (
    <section className="home-hero" id="hero" aria-labelledby="home-hero-title">
      <div className="home-hero-grid-bg" aria-hidden="true" />
      <div className="home-hero-inner">
        <div className="home-hero-copy">
          <p className="home-hero-eyebrow">
            <span className="home-hero-eyebrow-rule" aria-hidden="true" />
            Venture registry
          </p>
          <h1 id="home-hero-title" className="home-hero-title">
            Discover India&rsquo;s next generation of ventures.
          </h1>
          <p className="home-hero-lede">
            Browse televised Shark Tank India pitches and startups listed directly on Sauda, side by side:
            asks, equity, stage and business model in one registry.
          </p>

          <div className="home-hero-actions">
            <button type="button" className="home-btn home-btn-primary" onClick={onExplore}>
              <span>Explore the registry</span>
              <span aria-hidden="true">↓</span>
            </button>
            <button type="button" className="home-btn home-btn-ghost" onClick={onBrowseShow}>
              Shark Tank archive
            </button>
          </div>

          <p className="home-hero-note">
            Sauda is an academic DBMS prototype. Records are demonstration data and are not verified.
          </p>
        </div>

        <div className="home-hero-visual">
          <RegistryPreview
            startups={startups}
            loading={pending}
            hasError={unavailable}
            onSelect={onSelectStartup}
            onViewAll={onExplore}
            total={metrics.totalCount}
          />
        </div>
      </div>

      <div className="home-kpi-wrap">
        <dl className="home-kpi-band" aria-label="Registry summary">
          <div className="home-kpi">
            <dt>Published ventures</dt>
            <dd className="home-kpi-value">{total}</dd>
            <p className="home-kpi-sub">
              {unavailable
                ? 'Registry unavailable'
                : empty
                  ? 'No published ventures yet'
                  : isCapped
                    ? 'Showing the most recent listings'
                    : 'In the registry today'}
            </p>
          </div>

          <div className="home-kpi">
            <dt>By source</dt>
            <dd className="home-kpi-value home-kpi-split">
              <span>
                <b>{pending || unavailable ? dash : metrics.showCount}</b> Shark Tank
              </span>
              <span>
                <b>{pending || unavailable ? dash : metrics.platformCount}</b> Platform
              </span>
            </dd>
            <div
              className="home-kpi-bar"
              role="img"
              aria-label={
                pending || unavailable || metrics.totalCount === 0
                  ? 'Source distribution unavailable'
                  : `${metrics.showCount} Shark Tank pitches and ${metrics.platformCount} platform listings`
              }
            >
              <span style={{ width: `${pending || unavailable ? 0 : showPct}%` }} />
            </div>
          </div>

          <div className="home-kpi">
            <dt>Capital asked</dt>
            <dd className="home-kpi-value">{askValue}</dd>
            <p className="home-kpi-sub">{askSub}</p>
          </div>

          <div className="home-kpi">
            <dt>Avg. equity offered</dt>
            <dd className="home-kpi-value">{equityValue}</dd>
            <p className="home-kpi-sub">{equitySub}</p>
          </div>
        </dl>
      </div>
    </section>
  );
};

export default DiscoveryHero;
