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

const ROTATE_MS = 6000;
const FEATURED_COUNT = 5;
const VIDEO_SRC = '/media/sauda-pitch-arena.mp4';
const VIDEO_POSTER = '/media/sauda-pitch-arena-poster.jpg';

/** Subscribe to a CSS media query without effects (SSR-safe, updates live). */
function useMediaQuery(query: string): boolean {
  return React.useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Rotating spotlight over real registry records: one venture leaves, the next arrives. */
const FeaturedSpotlight: React.FC<{
  startups: Startup[];
  loading: boolean;
  hasError: boolean;
  reducedMotion: boolean;
  onSelect: (startup: Startup) => void;
  onViewAll: () => void;
}> = ({ startups, loading, hasError, reducedMotion, onSelect, onViewAll }) => {
  const pool = React.useMemo(() => startups.slice(0, FEATURED_COUNT), [startups]);
  const [rawIndex, setRawIndex] = React.useState(0);
  const [userPaused, setUserPaused] = React.useState(false);
  const [hovering, setHovering] = React.useState(false);

  const count = pool.length;
  const index = count > 0 ? rawIndex % count : 0;
  const playing = count > 1 && !reducedMotion && !userPaused && !hovering;

  React.useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setRawIndex((i) => i + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [playing, index]);

  const go = (delta: number) => setRawIndex((i) => (count ? (i + delta + count * 1000) % count : 0));

  if (loading) {
    return (
      <aside className="spotlight" aria-label="Featured venture" aria-busy="true">
        <div className="spotlight-card is-skeleton">
          <span className="rp-skel rp-skel-title" />
          <span className="rp-skel rp-skel-sub" />
          <span className="rp-skel rp-skel-block" />
        </div>
      </aside>
    );
  }

  if (hasError || count === 0) {
    return (
      <aside className="spotlight" aria-label="Featured venture">
        <div className="spotlight-card">
          <p className="spotlight-eyebrow">Featured venture</p>
          <p className="spotlight-empty">
            {hasError ? 'The registry is unavailable right now.' : 'New ventures will appear here as they are published.'}
          </p>
        </div>
      </aside>
    );
  }

  const s = pool[index];
  const next = pool[(index + 1) % count];
  const isPlatform = s.pitchType === 'PLATFORM';
  const hasAsk = s.originalAskAmount !== null && Number(s.originalAskAmount) > 0;
  const hasEq = s.originalAskEquityPct !== null && Number(s.originalAskEquityPct) > 0;

  return (
    <aside
      className="spotlight"
      aria-label="Featured venture"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      {count > 1 && <div className="spotlight-ghost" aria-hidden="true">{next.brandName}</div>}

      <div className="spotlight-card" key={s.pitchId} aria-live={playing ? 'off' : 'polite'}>
        <div className="spotlight-top">
          <p className="spotlight-eyebrow">Featured venture</p>
          {count > 1 && (
            <div className="spotlight-controls">
              <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={playing || !userPaused ? 'Pause rotation' : 'Resume rotation'} disabled={reducedMotion} className="spotlight-pause">
                {userPaused || reducedMotion ? '▶' : '❚❚'}
              </button>
              <button type="button" onClick={() => go(-1)} aria-label="Previous venture">←</button>
              <button type="button" onClick={() => go(1)} aria-label="Next venture">→</button>
            </div>
          )}
        </div>

        <div className="spotlight-head">
          <span className="spotlight-mark" aria-hidden="true">{s.brandName.charAt(0).toUpperCase()}</span>
          <div className="spotlight-title">
            <h2>{s.brandName}</h2>
            <span className={`rp-source ${isPlatform ? 'platform' : 'show'}`}>{isPlatform ? 'Platform' : 'Shark Tank'}</span>
          </div>
        </div>

        <p className="spotlight-hook">{s.pitchHook || [s.industry, s.startupStage].filter(Boolean).join(' · ') || 'Published venture'}</p>

        <dl className="spotlight-stats">
          <div>
            <dt>Capital asked</dt>
            <dd>{hasAsk ? formatCurrencyCompact(s.originalAskAmount) : '—'}</dd>
          </div>
          <div>
            <dt>Equity</dt>
            <dd>{hasEq ? formatEquity(s.originalAskEquityPct, 1) : '—'}</dd>
          </div>
          <div>
            <dt>{s.industry ? 'Sector' : 'Source'}</dt>
            <dd className="is-text">{s.industry || (isPlatform ? 'Platform' : 'Shark Tank')}</dd>
          </div>
        </dl>

        <button type="button" className="spotlight-cta" onClick={() => onSelect(s)} aria-label={`View details for ${s.brandName}`}>
          View details <span aria-hidden="true">→</span>
        </button>

        <div className="spotlight-foot">
          <div className="spotlight-dots" aria-hidden="true">
            {pool.map((p, i) => (
              <span key={p.pitchId} className={i === index ? 'on' : ''} />
            ))}
          </div>
          <button type="button" className="spotlight-all" onClick={onViewAll}>
            Browse all ventures
          </button>
        </div>
      </div>
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

  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const compactScreen = useMediaQuery('(max-width: 768px)');
  const [videoFailed, setVideoFailed] = React.useState(false);
  const showVideo = !reducedMotion && !compactScreen && !videoFailed;

  return (
    <section className="home-hero" id="hero" aria-labelledby="home-hero-title">
      <div className="home-hero-stage" aria-hidden="true">
        {showVideo && (
          <video
            className="home-hero-video"
            src={VIDEO_SRC}
            poster={VIDEO_POSTER}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            tabIndex={-1}
            onError={() => setVideoFailed(true)}
          />
        )}
        <div className="home-hero-poster" style={{ backgroundImage: `url(${VIDEO_POSTER})` }} />
        <div className="home-hero-shade" />
        <div className="home-hero-lights" />
      </div>

      <div className="home-hero-inner">
        <div className="home-hero-copy">
          <p className="home-hero-eyebrow">The Sauda pitch floor</p>
          <h1 id="home-hero-title" className="home-hero-title">
            Ideas enter.
            <span>Empires begin.</span>
          </h1>
          <p className="home-hero-lede">
            Discover standout ventures, explore founder pitches, and find opportunities worth a closer look.
          </p>

          <div className="home-hero-actions">
            <button type="button" className="home-btn home-btn-primary" onClick={onExplore}>
              <span>Explore the ventures</span>
              <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="home-btn home-btn-ghost" onClick={onBrowseShow}>
              <span className="home-btn-play" aria-hidden="true">▶</span>
              Shark Tank archive
            </button>
          </div>
        </div>

        <div className="home-hero-visual">
          <FeaturedSpotlight
            startups={startups}
            loading={pending}
            hasError={unavailable}
            reducedMotion={reducedMotion}
            onSelect={onSelectStartup}
            onViewAll={onExplore}
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
